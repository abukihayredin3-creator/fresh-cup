"""Persists the context of an approved candidate trade, keyed by trade_id.

``ai_brain.TradeRecord`` needs the structure/context fields (trend, bos,
choch, order_block, fair_value_gap, liquidity_sweep, strategy_tags,
planned RR, confidence at entry) again once a trade closes — but the EA's
``/trade_result`` payload only contains what it itself knows at close
time (prices, PnL, timing). This module remembers the rest, in the
bridge's own SQLite file under ``bridge/data/`` — separate from
``ai_brain/data/trade_history.db``, since the bridge owns this state,
not ``ai_brain``.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from bridge.config import CONFIG

_LOCK = threading.RLock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS pending_trades (
  trade_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL,
  trend TEXT NOT NULL,
  bos INTEGER NOT NULL,
  choch INTEGER NOT NULL,
  order_block INTEGER NOT NULL,
  fair_value_gap INTEGER NOT NULL,
  liquidity_sweep INTEGER NOT NULL,
  strategy_tags TEXT NOT NULL,
  risk_reward_planned REAL NOT NULL,
  confidence_at_entry REAL,
  created_at TEXT NOT NULL
);
"""


@dataclass
class PendingTradeContext:
    trade_id: str
    symbol: str
    timeframe: str
    direction: str
    trend: str
    bos: bool
    choch: bool
    order_block: bool
    fair_value_gap: bool
    liquidity_sweep: bool
    strategy_tags: list[str]
    risk_reward_planned: float
    confidence_at_entry: float | None


def _db_path() -> Path:
    return CONFIG.data_dir / "pending_trades.db"


def _get_connection() -> sqlite3.Connection:
    CONFIG.data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_db_path()), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA)
    return conn


@contextmanager
def _cursor(commit: bool = False) -> Iterator[sqlite3.Cursor]:
    with _LOCK:
        conn = _get_connection()
        try:
            cur = conn.cursor()
            yield cur
            if commit:
                conn.commit()
        except Exception:
            if commit:
                conn.rollback()
            raise
        finally:
            conn.close()


def save_pending_trade(context: PendingTradeContext) -> None:
    """Persist (or replace) the context for an approved trade. Re-saving
    the same trade_id overwrites — the EA is expected to call this
    exactly once per approval, but idempotent-on-retry is safer than not.
    """
    with _cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT OR REPLACE INTO pending_trades
              (trade_id, symbol, timeframe, direction, trend, bos, choch, order_block,
               fair_value_gap, liquidity_sweep, strategy_tags, risk_reward_planned,
               confidence_at_entry, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                context.trade_id,
                context.symbol,
                context.timeframe,
                context.direction,
                context.trend,
                int(context.bos),
                int(context.choch),
                int(context.order_block),
                int(context.fair_value_gap),
                int(context.liquidity_sweep),
                json.dumps(context.strategy_tags),
                context.risk_reward_planned,
                context.confidence_at_entry,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def get_pending_trade(trade_id: str) -> PendingTradeContext | None:
    with _cursor() as cur:
        cur.execute("SELECT * FROM pending_trades WHERE trade_id = ?", (trade_id,))
        row = cur.fetchone()

    if row is None:
        return None

    return PendingTradeContext(
        trade_id=row["trade_id"],
        symbol=row["symbol"],
        timeframe=row["timeframe"],
        direction=row["direction"],
        trend=row["trend"],
        bos=bool(row["bos"]),
        choch=bool(row["choch"]),
        order_block=bool(row["order_block"]),
        fair_value_gap=bool(row["fair_value_gap"]),
        liquidity_sweep=bool(row["liquidity_sweep"]),
        strategy_tags=json.loads(row["strategy_tags"]),
        risk_reward_planned=row["risk_reward_planned"],
        confidence_at_entry=row["confidence_at_entry"],
    )


def delete_pending_trade(trade_id: str) -> None:
    """Drop the context once the trade has closed and been recorded —
    prevents ``pending_trades`` from growing unbounded."""
    with _cursor(commit=True) as cur:
        cur.execute("DELETE FROM pending_trades WHERE trade_id = ?", (trade_id,))
