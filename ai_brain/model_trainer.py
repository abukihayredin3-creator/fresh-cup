"""Retrain orchestration: triggers, walk-forward validation, promotion.

Retraining is triggered automatically every ``RETRAIN_EVERY_N_TRADES``
closed trades or weekly (whichever comes first), gated by a minimum
number of total closed trades. Every training run is persisted via
``model_manager.save_model`` regardless of outcome — nothing is ever
discarded — but a new model is only promoted to *active* if it beats the
current active model's combined validation/test score. This implements
"reject models with lower accuracy, keep the best" without ever deleting
a trained artifact, and makes rollback always possible.

Chronological ordering note: ``dataset_builder.get_training_dataframe()``
returns rows in the order trades were closed (both the incremental append
path and the full rebuild path preserve entry-time order), so this module
relies on DataFrame row order for the time-based train/val/test split and
walk-forward folds rather than re-deriving a timestamp from the engineered
feature columns (which intentionally only keep day-of-week/hour-of-day,
not an absolute date, to avoid the model keying off calendar dates).
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import pandas as pd

from ai_brain import model_manager, xgboost_engine
from ai_brain.config import CONFIG
from ai_brain.dataset_builder import get_training_dataframe
from ai_brain.utils import db_cursor, from_iso, get_logger, to_iso, utcnow

logger = get_logger(__name__)


@dataclass
class TrainerState:
    trades_since_last_train: int
    last_train_at: str | None
    last_trade_seen_at: str | None


@dataclass
class RetrainResult:
    version: str
    accepted: bool
    metrics: dict
    trades_used: int
    trigger_reason: str
    rejected_reason: str | None = None


def get_trainer_state() -> TrainerState:
    with db_cursor() as cur:
        cur.execute(
            "SELECT trades_since_last_train, last_train_at, last_trade_seen_at "
            "FROM trainer_state WHERE id = 1"
        )
        row = cur.fetchone()
    if row is None:
        return TrainerState(trades_since_last_train=0, last_train_at=None, last_trade_seen_at=None)
    return TrainerState(
        trades_since_last_train=row["trades_since_last_train"],
        last_train_at=row["last_train_at"],
        last_trade_seen_at=row["last_trade_seen_at"],
    )


def on_trade_recorded() -> None:
    """Called once per newly recorded closed trade to advance trainer state."""
    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE trainer_state
            SET trades_since_last_train = trades_since_last_train + 1,
                last_trade_seen_at = ?
            WHERE id = 1
            """,
            (to_iso(utcnow()),),
        )


def _total_closed_trades() -> int:
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as n FROM trades WHERE is_closed = 1")
        return cur.fetchone()["n"]


def should_retrain(state: TrainerState | None = None) -> tuple[bool, str]:
    """Whether a retrain should run now, and why."""
    if _total_closed_trades() < CONFIG.MIN_TRADES_TO_TRAIN:
        return False, "insufficient_data"

    state = state or get_trainer_state()

    if state.trades_since_last_train >= CONFIG.RETRAIN_EVERY_N_TRADES:
        return True, "count"

    if CONFIG.RETRAIN_WEEKLY:
        if state.last_train_at is None:
            return True, "weekly"
        elapsed = utcnow() - from_iso(state.last_train_at)
        if elapsed.days >= CONFIG.RETRAIN_WEEKLY_DAYS:
            return True, "weekly"

    return False, "not_due"


def _reset_trainer_state() -> None:
    with db_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE trainer_state SET trades_since_last_train = 0, last_train_at = ? WHERE id = 1",
            (to_iso(utcnow()),),
        )


def _log_training_run(
    trigger_reason: str, trades_used: int, version: str, accepted: bool, metrics: dict, rejected_reason: str | None
) -> None:
    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO training_runs
              (run_at, trigger_reason, trades_used, model_version_produced, accepted, metrics_json, rejected_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                to_iso(utcnow()),
                trigger_reason,
                trades_used,
                version,
                int(accepted),
                json.dumps(metrics, default=str),
                rejected_reason,
            ),
        )


def _walk_forward_validate(train_val_df: pd.DataFrame) -> float:
    """Expanding-window walk-forward validation. Returns mean fold accuracy."""
    n = len(train_val_df)
    folds = min(CONFIG.WALK_FORWARD_FOLDS, max(1, n // 10))
    fold_size = max(1, n // (folds + 1))

    scores = []
    for i in range(1, folds + 1):
        train_end = fold_size * i
        val_end = min(n, fold_size * (i + 1))
        if val_end <= train_end:
            continue
        fold_train = train_val_df.iloc[:train_end]
        fold_val = train_val_df.iloc[train_end:val_end]
        if fold_train.empty or fold_val.empty or fold_train["win"].nunique() < 2:
            continue
        try:
            fold_bundle = xgboost_engine.fit(fold_train, version="walk_forward_tmp")
            fold_metrics = xgboost_engine.evaluate(fold_bundle, fold_val)
            if fold_metrics["n"] > 0:
                scores.append(fold_metrics["accuracy"])
        except ValueError:
            continue

    if not scores:
        return float("nan")
    return sum(scores) / len(scores)


def retrain(trigger_reason: str = "manual") -> RetrainResult:
    """Run a full train/validate/test cycle and promote the model if it
    beats the current active model. Always persists the trained artifact.
    """
    df = get_training_dataframe()
    df = df.dropna(subset=["win", "pnl", "realized_rr"])
    n = len(df)

    if n < CONFIG.MIN_TRADES_TO_TRAIN:
        raise ValueError(
            f"Not enough labeled trades to train: have {n}, need {CONFIG.MIN_TRADES_TO_TRAIN}."
        )

    test_size = max(1, int(n * CONFIG.TRAIN_TEST_SPLIT))
    train_val_df = df.iloc[: n - test_size]
    test_df = df.iloc[n - test_size :]

    walk_forward_accuracy = _walk_forward_validate(train_val_df)

    candidate_version = model_manager.next_version()
    candidate_bundle = xgboost_engine.fit(train_val_df, version=candidate_version)
    test_metrics = xgboost_engine.evaluate(candidate_bundle, test_df)

    wf_component = walk_forward_accuracy if walk_forward_accuracy == walk_forward_accuracy else test_metrics["accuracy"]  # NaN check
    combined_score = 0.5 * wf_component + 0.5 * test_metrics["accuracy"]

    metrics = {
        "walk_forward_accuracy": walk_forward_accuracy,
        "test": test_metrics,
        "combined_score": combined_score,
    }

    active_version = model_manager.get_active_version()
    should_activate = active_version is None
    rejected_reason = None

    if not should_activate:
        try:
            active_meta = model_manager.get_metadata(active_version)
            active_score = active_meta.metrics.get("combined_score", float("-inf"))
        except model_manager.ModelVersionNotFoundError:
            active_score = float("-inf")

        if combined_score > active_score:
            should_activate = True
        else:
            rejected_reason = (
                f"combined_score {combined_score:.4f} did not beat active model "
                f"{active_version}'s {active_score:.4f}"
            )

    version = model_manager.save_model(
        candidate_bundle,
        metrics=metrics,
        trigger_reason=trigger_reason,
        trades_used=n,
        activate=should_activate,
    )

    _log_training_run(trigger_reason, n, version, should_activate, metrics, rejected_reason)
    _reset_trainer_state()

    logger.info(
        "Retrain complete: version=%s accepted=%s combined_score=%.4f",
        version, should_activate, combined_score,
    )

    return RetrainResult(
        version=version,
        accepted=should_activate,
        metrics=metrics,
        trades_used=n,
        trigger_reason=trigger_reason,
        rejected_reason=rejected_reason,
    )


def maybe_retrain(force: bool = False) -> RetrainResult | None:
    """Retrain if due (or ``force=True``); returns None if not triggered."""
    if force:
        return retrain(trigger_reason="manual")

    triggered, reason = should_retrain()
    if not triggered:
        return None
    return retrain(trigger_reason=reason)
