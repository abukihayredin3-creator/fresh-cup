"""Persists closed trades and maintains the engineered training dataset.

Two artifacts are maintained:

* ``data/trade_history.db`` (SQLite) — the source of truth. Every closed
  trade is written here first, verbatim.
* ``data/training_dataset.csv`` — the derived, engineered feature view
  used for training. Rebuilt from the DB by replaying trades in
  chronological order through ``feature_engine.build_features`` so
  rolling statistics are always consistent.

Only CLOSED trades are ever persisted here. ``append_closed_trade`` raises
if handed an unclosed trade — this is the hard guarantee that the AI Brain
never trains on open positions.

Categorical columns (symbol, timeframe, session, market_regime) are kept
as human-readable strings in the CSV; label-encoding them into integers
for the model is ``xgboost_engine``'s job (its encoders are persisted
alongside the model so train/predict stay consistent). This module's
"encode categorical values" responsibility is limited to normalizing
their *text* (trimmed, lowercased) so the same category never appears as
two different strings.
"""

from __future__ import annotations

import argparse
import json
import threading
from pathlib import Path

import numpy as np
import pandas as pd

from ai_brain.config import CONFIG
from ai_brain.feature_engine import (
    CATEGORICAL_COLUMNS,
    FEATURE_COLUMNS,
    TradeRecord,
    build_features,
    to_feature_dict,
)
from ai_brain.market_regime import classify_regime
from ai_brain.utils import db_cursor, from_iso, get_logger, to_iso, utcnow

logger = get_logger(__name__)

CSV_LOCK = threading.RLock()

# Columns that must be present and non-null for a training row to be usable.
_REQUIRED_NON_NULL = ["win", "pnl", "realized_rr", "atr", "risk_reward_planned"]

_CSV_COLUMNS = (
    ["trade_id"]
    + FEATURE_COLUMNS
    + ["win", "pnl", "realized_rr", "dataset_version", "added_at"]
)


class InvalidTradeError(ValueError):
    """Raised when a trade cannot be persisted as a closed trade."""


def _trade_to_row(record: TradeRecord) -> dict:
    return {
        "trade_id": record.trade_id,
        "symbol": record.symbol,
        "timeframe": record.timeframe,
        "direction": record.direction,
        "entry_time": to_iso(record.entry_time),
        "exit_time": to_iso(record.exit_time),
        "entry_price": record.entry_price,
        "exit_price": record.exit_price,
        "stop_loss": record.stop_loss,
        "take_profit": record.take_profit,
        "lot_size": record.lot_size,
        "atr": record.atr,
        "spread": record.spread,
        "volume": record.volume,
        "trend": record.trend,
        "bos": int(record.bos),
        "choch": int(record.choch),
        "order_block": int(record.order_block),
        "fair_value_gap": int(record.fair_value_gap),
        "liquidity_sweep": int(record.liquidity_sweep),
        "strategy_tags": json.dumps(record.strategy_tags or []),
        "risk_reward_planned": record.risk_reward_planned,
        "confidence_at_entry": record.confidence_at_entry,
        "pnl": record.pnl,
        "outcome": record.outcome,
        "is_closed": 1,
        "notes": record.notes,
        "created_at": to_iso(utcnow()),
    }


def _row_to_trade(row) -> TradeRecord:
    return TradeRecord(
        trade_id=row["trade_id"],
        symbol=row["symbol"],
        timeframe=row["timeframe"],
        direction=row["direction"],
        entry_time=from_iso(row["entry_time"]),
        exit_time=from_iso(row["exit_time"]),
        entry_price=row["entry_price"],
        exit_price=row["exit_price"],
        stop_loss=row["stop_loss"],
        take_profit=row["take_profit"],
        lot_size=row["lot_size"],
        atr=row["atr"],
        spread=row["spread"],
        volume=row["volume"],
        trend=row["trend"],
        bos=bool(row["bos"]),
        choch=bool(row["choch"]),
        order_block=bool(row["order_block"]),
        fair_value_gap=bool(row["fair_value_gap"]),
        liquidity_sweep=bool(row["liquidity_sweep"]),
        strategy_tags=json.loads(row["strategy_tags"] or "[]"),
        risk_reward_planned=row["risk_reward_planned"],
        confidence_at_entry=row["confidence_at_entry"],
        pnl=row["pnl"],
        outcome=row["outcome"],
        is_closed=bool(row["is_closed"]),
        notes=row["notes"] or "",
    )


def append_closed_trade(record: TradeRecord) -> None:
    """Persist a closed trade to trade_history.db and append its engineered
    features to training_dataset.csv.

    Idempotent on ``trade_id``: re-recording the same trade_id is a no-op,
    not a duplicate row, so retries from the calling bot are safe.
    """
    if not record.is_closed:
        raise InvalidTradeError(
            f"Trade {record.trade_id} is not closed; the AI Brain only "
            "learns from completed trades."
        )

    row = _trade_to_row(record)
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT 1 FROM trades WHERE trade_id = ?", (record.trade_id,))
        if cur.fetchone() is not None:
            logger.debug("Trade %s already recorded, skipping.", record.trade_id)
            return

        columns = ", ".join(row.keys())
        placeholders = ", ".join("?" for _ in row)
        cur.execute(
            f"INSERT INTO trades ({columns}) VALUES ({placeholders})",
            list(row.values()),
        )

    logger.info("Recorded closed trade %s (%s, %s)", record.trade_id, record.symbol, record.outcome)
    _append_feature_row(record)


def _append_feature_row(record: TradeRecord) -> None:
    """Append one engineered feature row for ``record`` to the CSV.

    Uses the closed-trade history strictly before ``record.entry_time`` so
    rolling stats match what would have been known at trade time.
    """
    history = get_closed_trades_df_as_records(before=record.entry_time)
    regime = classify_regime(
        volatility=(record.atr / record.entry_price) if record.entry_price else 0.0,
        trend_strength=0.5,
    ).regime
    features = build_features(record, history, market_regime=regime)
    row = to_feature_dict(features)

    with CSV_LOCK:
        version = _current_dataset_version()
        row["dataset_version"] = version
        row["added_at"] = to_iso(utcnow())
        df_row = pd.DataFrame([row], columns=_CSV_COLUMNS)

        CONFIG.TRAINING_DATASET_CSV.parent.mkdir(parents=True, exist_ok=True)
        write_header = not CONFIG.TRAINING_DATASET_CSV.exists()
        df_row.to_csv(
            CONFIG.TRAINING_DATASET_CSV, mode="a", header=write_header, index=False
        )


def _current_dataset_version() -> int:
    if not CONFIG.TRAINING_DATASET_CSV.exists():
        return 1
    try:
        df = pd.read_csv(CONFIG.TRAINING_DATASET_CSV, usecols=["dataset_version"])
        if df.empty:
            return 1
        return int(df["dataset_version"].max())
    except (pd.errors.EmptyDataError, ValueError, KeyError):
        return 1


def _is_valid_record(record: TradeRecord) -> bool:
    """A record is usable for feature engineering / rolling stats only if
    its core numeric fields are present. Corrupted rows (e.g. a NULL pnl
    from a data-integrity issue) are excluded here so they can never
    silently break rolling-stat computation for every trade that comes
    after them.
    """
    return (
        record.pnl is not None
        and record.atr is not None
        and record.entry_price is not None
        and record.risk_reward_planned is not None
    )


def get_closed_trades_df_as_records(before=None, limit: int | None = None) -> list[TradeRecord]:
    """Chronological list of closed TradeRecords, oldest first.

    ``before`` optionally restricts to trades whose entry_time is strictly
    earlier (used to reconstruct "what was known at the time"). Corrupted
    records (missing core numeric fields) are silently excluded.
    """
    query = "SELECT * FROM trades WHERE is_closed = 1 ORDER BY entry_time ASC"
    with db_cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    records = [_row_to_trade(r) for r in rows]
    records = [r for r in records if _is_valid_record(r)]
    if before is not None:
        records = [r for r in records if r.entry_time < before]
    if limit is not None:
        records = records[-limit:]
    return records


def get_closed_trades_df(limit: int | None = None, symbol: str | None = None) -> pd.DataFrame:
    """Raw closed trades from the DB as a DataFrame (not engineered features)."""
    query = "SELECT * FROM trades WHERE is_closed = 1"
    params: list = []
    if symbol:
        query += " AND symbol = ?"
        params.append(symbol)
    query += " ORDER BY entry_time ASC"

    with db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
        columns = [d[0] for d in cur.description]

    df = pd.DataFrame([dict(zip(columns, r)) for r in rows], columns=columns)
    if limit is not None and not df.empty:
        df = df.tail(limit)
    return df


def _clean_and_normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Clean corrupted rows and tame numeric outliers.

    "Normalize" here means: replace inf/-inf with NaN, drop rows missing
    required fields, and clip extreme numeric outliers to the 1st/99th
    percentile so a single bad tick doesn't dominate training. Values are
    NOT z-scored/min-max scaled because the model (XGBoost, tree-based)
    does not require feature scaling and doing so would only add a
    stateful transform that predict-time would have to replicate exactly.
    """
    df = df.replace([np.inf, -np.inf], np.nan)

    before = len(df)
    df = df.dropna(subset=[c for c in _REQUIRED_NON_NULL if c in df.columns])
    dropped = before - len(df)
    if dropped:
        logger.warning("Dropped %d corrupted row(s) missing required fields.", dropped)

    df = df.drop_duplicates(subset=["trade_id"], keep="last")

    numeric_cols = [
        c
        for c in FEATURE_COLUMNS
        if c not in CATEGORICAL_COLUMNS and pd.api.types.is_numeric_dtype(df.get(c, pd.Series(dtype=float)))
    ]
    for col in numeric_cols:
        if col not in df.columns or df[col].dropna().empty:
            continue
        lower, upper = df[col].quantile(0.01), df[col].quantile(0.99)
        if lower < upper:
            df[col] = df[col].clip(lower, upper)

    for col in CATEGORICAL_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.lower()

    return df.reset_index(drop=True)


def rebuild_dataset_from_db() -> pd.DataFrame:
    """Full clean/rebuild pass: replay all closed trades chronologically
    through the feature engine and rewrite training_dataset.csv from
    scratch. Bumps ``dataset_version`` for every row in this pass.
    """
    records = get_closed_trades_df_as_records()
    if not records:
        logger.info("No closed trades yet; nothing to rebuild.")
        return pd.DataFrame(columns=_CSV_COLUMNS)

    version = _current_dataset_version() + 1
    rows = []
    for i, record in enumerate(records):
        history = records[:i]
        regime = classify_regime(
            volatility=(record.atr / record.entry_price) if record.entry_price else 0.0,
            trend_strength=0.5,
        ).regime
        features = build_features(record, history, market_regime=regime)
        row = to_feature_dict(features)
        row["dataset_version"] = version
        row["added_at"] = to_iso(utcnow())
        rows.append(row)

    df = pd.DataFrame(rows, columns=_CSV_COLUMNS)
    df = _clean_and_normalize(df)

    with CSV_LOCK:
        CONFIG.TRAINING_DATASET_CSV.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(CONFIG.TRAINING_DATASET_CSV, index=False)

    logger.info("Rebuilt training_dataset.csv: %d rows, version %d.", len(df), version)
    return df


def get_training_dataframe() -> pd.DataFrame:
    """The current engineered training dataset, cleaned and normalized.

    Rebuilds from the DB if the CSV doesn't exist yet.
    """
    if not CONFIG.TRAINING_DATASET_CSV.exists():
        return rebuild_dataset_from_db()

    with CSV_LOCK:
        df = pd.read_csv(CONFIG.TRAINING_DATASET_CSV)
    return _clean_and_normalize(df)


def _main() -> None:
    parser = argparse.ArgumentParser(description="AI Brain dataset builder")
    parser.add_argument(
        "--rebuild", action="store_true", help="Rebuild training_dataset.csv from trade_history.db"
    )
    args = parser.parse_args()
    if args.rebuild:
        df = rebuild_dataset_from_db()
        print(f"Rebuilt dataset with {len(df)} rows.")
    else:
        parser.print_help()


if __name__ == "__main__":
    _main()
