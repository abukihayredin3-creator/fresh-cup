"""Shared low-level helpers: logging, SQLite access, atomic I/O, time helpers.

Nothing in here knows about trades or models — it is pure plumbing so the
higher layers stay focused on domain logic.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import tempfile
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Iterator

from ai_brain.config import CONFIG

# A single process-wide lock guarding all writes to trade_history.db.
# SQLite's WAL mode allows concurrent readers, but we serialize writers
# from this process explicitly to avoid "database is locked" retries.
DB_LOCK = threading.RLock()

_loggers: dict[str, logging.Logger] = {}
_loggers_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS trades (
  trade_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_time TEXT NOT NULL,
  exit_time TEXT NOT NULL,
  entry_price REAL,
  exit_price REAL,
  stop_loss REAL,
  take_profit REAL,
  lot_size REAL,
  atr REAL,
  spread REAL,
  volume REAL,
  trend TEXT,
  bos INTEGER,
  choch INTEGER,
  order_block INTEGER,
  fair_value_gap INTEGER,
  liquidity_sweep INTEGER,
  strategy_tags TEXT,
  risk_reward_planned REAL,
  confidence_at_entry REAL,
  pnl REAL,
  outcome TEXT,
  is_closed INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);

CREATE TABLE IF NOT EXISTS predictions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id TEXT NOT NULL,
  predicted_at TEXT NOT NULL,
  model_version TEXT,
  win_probability REAL,
  expected_rr REAL,
  expected_profit REAL,
  confidence REAL,
  actual_outcome TEXT,
  actual_pnl REAL,
  evaluated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_predictions_trade_id ON predictions_log(trade_id);

CREATE TABLE IF NOT EXISTS training_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  trigger_reason TEXT,
  trades_used INTEGER,
  model_version_produced TEXT,
  accepted INTEGER,
  metrics_json TEXT,
  rejected_reason TEXT
);

CREATE TABLE IF NOT EXISTS trainer_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  trades_since_last_train INTEGER NOT NULL DEFAULT 0,
  last_train_at TEXT,
  last_trade_seen_at TEXT
);
"""


def ensure_directories() -> None:
    """Create all AI Brain directories if they don't exist yet."""
    for path in (
        CONFIG.DATA_DIR,
        CONFIG.MODELS_DIR,
        CONFIG.LOGS_DIR,
        CONFIG.SNAPSHOTS_DIR,
    ):
        path.mkdir(parents=True, exist_ok=True)


def get_logger(name: str) -> logging.Logger:
    """Return a module-scoped logger with a rotating file handler.

    Idempotent: calling this repeatedly with the same name returns the
    same configured logger instead of stacking duplicate handlers.
    """
    with _loggers_lock:
        if name in _loggers:
            return _loggers[name]

        ensure_directories()
        logger = logging.getLogger(name)
        logger.setLevel(CONFIG.LOG_LEVEL)
        logger.propagate = False

        if not logger.handlers:
            fmt = logging.Formatter(
                "%(asctime)s %(levelname)s [%(name)s] %(message)s"
            )
            file_handler = RotatingFileHandler(
                CONFIG.LOG_FILE,
                maxBytes=CONFIG.LOG_MAX_BYTES,
                backupCount=CONFIG.LOG_BACKUP_COUNT,
            )
            file_handler.setFormatter(fmt)
            logger.addHandler(file_handler)

            stream_handler = logging.StreamHandler()
            stream_handler.setFormatter(fmt)
            logger.addHandler(stream_handler)

        _loggers[name] = logger
        return logger


def init_db(conn: sqlite3.Connection) -> None:
    """Idempotently create the AI Brain's SQLite schema."""
    conn.executescript(_SCHEMA)
    conn.execute(
        "INSERT OR IGNORE INTO trainer_state (id, trades_since_last_train) VALUES (1, 0)"
    )
    conn.commit()


def get_db_connection() -> sqlite3.Connection:
    """Open a new SQLite connection to trade_history.db in WAL mode.

    Callers are responsible for closing the connection (use as a context
    manager or via ``db_cursor``/``db_connection`` helpers below).
    """
    ensure_directories()
    conn = sqlite3.connect(str(CONFIG.TRADE_HISTORY_DB), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    return conn


@contextmanager
def db_connection() -> Iterator[sqlite3.Connection]:
    """Context manager yielding a connection, closed on exit."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def db_cursor(commit: bool = False) -> Iterator[sqlite3.Cursor]:
    """Context manager yielding a cursor under DB_LOCK.

    Set ``commit=True`` for write operations; the connection commits (or
    rolls back on exception) before closing.
    """
    with DB_LOCK:
        conn = get_db_connection()
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


def atomic_write_json(path: Path, data: dict) -> None:
    """Write JSON to ``path`` atomically (temp file + os.replace)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, default=str)
        os.replace(tmp_path, path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def read_json(path: Path, default: dict | None = None) -> dict:
    """Read JSON from ``path``, returning ``default`` if it doesn't exist."""
    if not path.exists():
        return {} if default is None else default
    with open(path) as f:
        return json.load(f)


SESSION_BOUNDARIES = (
    (0, 8, "asian"),
    (8, 13, "london"),
    (13, 16, "london_ny_overlap"),
    (16, 21, "ny"),
    (21, 24, "off_hours"),
)


def get_session(dt: datetime) -> str:
    """Map a UTC datetime's hour to a trading session bucket."""
    hour = dt.astimezone(timezone.utc).hour if dt.tzinfo else dt.hour
    for start, end, name in SESSION_BOUNDARIES:
        if start <= hour < end:
            return name
    return "off_hours"


def hash_tags(tags: list[str]) -> int:
    """Order-independent stable hash of a list of strategy tags."""
    if not tags:
        return 0
    normalized = tuple(sorted(t.strip().lower() for t in tags if t.strip()))
    return hash(normalized) & 0xFFFFFFFF


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def from_iso(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
