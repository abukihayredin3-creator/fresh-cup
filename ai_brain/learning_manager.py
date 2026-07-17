"""Continuous learning bookkeeping: reconciles predictions vs. actual
outcomes and tracks model/prediction performance over time.

This is the module that turns "we made a prediction" into "and here's
how right we actually were" — the feedback loop that lets
``/learning`` and ``/dashboard`` report real prediction accuracy, not
just training-time metrics.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import pandas as pd

from ai_brain import model_manager, model_trainer
from ai_brain.utils import db_cursor, from_iso, get_logger, to_iso, utcnow

logger = get_logger(__name__)


@dataclass
class LearningStats:
    recent_accuracy: float
    long_term_accuracy: float
    recent_sample_size: int
    long_term_sample_size: int
    current_win_rate: float
    active_model_version: str | None
    active_model_trained_at: str | None
    computed_at: str


def record_actual_outcome(trade_id: str, actual_outcome: str, actual_pnl: float) -> None:
    """Reconcile a prediction with the trade's real outcome once it closes.

    No-op (logged at debug) if this trade was never scored — e.g. the AI
    Brain was disabled at prediction time, or no model existed yet.
    """
    with db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id FROM predictions_log WHERE trade_id = ? AND evaluated_at IS NULL "
            "ORDER BY predicted_at DESC LIMIT 1",
            (trade_id,),
        )
        row = cur.fetchone()
        if row is None:
            logger.debug("No pending prediction found for trade %s; nothing to reconcile.", trade_id)
            return

        cur.execute(
            "UPDATE predictions_log SET actual_outcome = ?, actual_pnl = ?, evaluated_at = ? WHERE id = ?",
            (actual_outcome, actual_pnl, to_iso(utcnow()), row["id"]),
        )
    logger.info("Reconciled prediction for trade %s: outcome=%s", trade_id, actual_outcome)


def _evaluated_predictions_df() -> pd.DataFrame:
    with db_cursor() as cur:
        cur.execute(
            "SELECT trade_id, predicted_at, model_version, win_probability, actual_outcome "
            "FROM predictions_log WHERE evaluated_at IS NOT NULL"
        )
        rows = cur.fetchall()
        columns = [d[0] for d in cur.description]
    return pd.DataFrame([dict(zip(columns, r)) for r in rows], columns=columns)


def compute_learning_stats(recent_window_days: int = 30) -> LearningStats:
    df = _evaluated_predictions_df()
    active_version = model_manager.get_active_version()
    active_trained_at = None
    if active_version:
        try:
            active_trained_at = model_manager.get_metadata(active_version).trained_at
        except model_manager.ModelVersionNotFoundError:
            active_trained_at = None

    if df.empty:
        return LearningStats(
            recent_accuracy=float("nan"),
            long_term_accuracy=float("nan"),
            recent_sample_size=0,
            long_term_sample_size=0,
            current_win_rate=float("nan"),
            active_model_version=active_version,
            active_model_trained_at=active_trained_at,
            computed_at=utcnow().isoformat(),
        )

    df["predicted_win"] = df["win_probability"] >= 0.5
    df["actual_win"] = df["actual_outcome"] == "win"
    df["correct"] = df["predicted_win"] == df["actual_win"]

    long_term_accuracy = float(df["correct"].mean())
    long_term_sample_size = len(df)

    cutoff = utcnow() - timedelta(days=recent_window_days)
    recent_df = df[df["predicted_at"].apply(lambda s: from_iso(s) >= cutoff)]
    recent_accuracy = float(recent_df["correct"].mean()) if not recent_df.empty else float("nan")
    recent_sample_size = len(recent_df)
    current_win_rate = float(recent_df["actual_win"].mean()) if not recent_df.empty else float("nan")

    return LearningStats(
        recent_accuracy=recent_accuracy,
        long_term_accuracy=long_term_accuracy,
        recent_sample_size=recent_sample_size,
        long_term_sample_size=long_term_sample_size,
        current_win_rate=current_win_rate,
        active_model_version=active_version,
        active_model_trained_at=active_trained_at,
        computed_at=utcnow().isoformat(),
    )


def performance_over_time(bucket: str = "week") -> pd.DataFrame:
    """Prediction accuracy bucketed over time (``bucket``: day/week/month)."""
    freq = {"day": "D", "week": "W", "month": "M"}.get(bucket, "W")
    df = _evaluated_predictions_df()
    if df.empty:
        return pd.DataFrame(columns=["period", "accuracy", "sample_size"])

    df["predicted_win"] = df["win_probability"] >= 0.5
    df["actual_win"] = df["actual_outcome"] == "win"
    df["correct"] = df["predicted_win"] == df["actual_win"]
    df["period"] = pd.to_datetime(df["predicted_at"]).dt.to_period(freq).astype(str)

    grouped = df.groupby("period").agg(accuracy=("correct", "mean"), sample_size=("correct", "count"))
    return grouped.reset_index()


def get_trainer_status() -> dict:
    """Consolidated trainer + model registry status for /learning and /model."""
    state = model_trainer.get_trainer_state()
    triggered, reason = model_trainer.should_retrain(state)
    versions = model_manager.list_versions()

    return {
        "trades_since_last_train": state.trades_since_last_train,
        "last_train_at": state.last_train_at,
        "retrain_due": triggered,
        "retrain_due_reason": reason,
        "active_version": model_manager.get_active_version(),
        "model_versions": [
            {
                "version": v.version,
                "trained_at": v.trained_at,
                "trades_used": v.trades_used,
                "metrics": v.metrics,
                "is_active": v.is_active,
                "trigger_reason": v.trigger_reason,
            }
            for v in versions
        ],
    }
