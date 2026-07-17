"""Trade data contracts and feature engineering.

This module defines the contract the real MT5 trading bot will eventually
fill in (``TradeRecord`` for closed trades, ``CandidateTrade`` for a trade
being considered) and derives the engineered ``TradeFeatures`` the rest of
the AI Brain trains and predicts on.

``build_features`` is a pure function: it never touches the database. The
caller is responsible for supplying the chronological trade history it
needs for rolling statistics. This keeps the module trivially testable and
keeps "who reads the DB" the sole responsibility of ``dataset_builder``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ai_brain.utils import get_session, hash_tags

# ---------------------------------------------------------------------------
# Raw contracts (filled in by the trading bot)
# ---------------------------------------------------------------------------


@dataclass
class TradeRecord:
    """A CLOSED trade, as reported by the trading bot.

    This is the contract the real MT5 bot must satisfy when calling
    ``ai_brain.record_trade()``. All SMC/ICT signal fields (bos, choch,
    order_block, fair_value_gap, liquidity_sweep) are booleans the bot
    determined at entry time from its own market structure analysis.
    """

    trade_id: str
    symbol: str
    timeframe: str
    direction: str  # "buy" | "sell"
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    lot_size: float
    atr: float
    spread: float
    volume: float
    trend: str  # "up" | "down" | "sideways"
    bos: bool
    choch: bool
    order_block: bool
    fair_value_gap: bool
    liquidity_sweep: bool
    strategy_tags: list[str]
    risk_reward_planned: float
    confidence_at_entry: float | None
    pnl: float
    outcome: str  # "win" | "loss" | "breakeven"
    is_closed: bool = True
    notes: str = ""


@dataclass
class CandidateTrade:
    """An OPEN or about-to-be-taken trade. No outcome fields exist yet."""

    trade_id: str
    symbol: str
    timeframe: str
    direction: str
    entry_time: datetime
    entry_price: float
    stop_loss: float
    take_profit: float
    atr: float
    spread: float
    volume: float
    trend: str
    bos: bool
    choch: bool
    order_block: bool
    fair_value_gap: bool
    liquidity_sweep: bool
    strategy_tags: list[str]
    risk_reward_planned: float
    confidence_at_entry: float | None = None


# ---------------------------------------------------------------------------
# Engineered output
# ---------------------------------------------------------------------------


@dataclass
class RollingStats:
    win_rate: float
    avg_rr: float
    avg_pnl: float
    sample_size: int


@dataclass
class TradeFeatures:
    trade_id: str
    symbol: str
    timeframe: str
    session: str
    day_of_week: int
    hour_of_day: int
    atr: float
    spread: float
    volume: float
    volatility: float
    trend_encoded: int
    bos: int
    choch: int
    order_block: int
    fair_value_gap: int
    liquidity_sweep: int
    risk_reward_planned: float
    confidence_at_entry: float
    strategy_tag_hash: int
    prev_trade_outcome: int
    prev5_win_rate: float
    prev5_avg_rr: float
    prev5_avg_pnl: float
    prev20_win_rate: float
    prev20_avg_rr: float
    prev20_avg_pnl: float
    market_regime: str
    trade_duration_minutes: float | None
    win: int | None
    pnl: float | None
    realized_rr: float | None


# Canonical ordered feature-column list shared by xgboost_engine (train/predict)
# and pattern_engine (groupby). CATEGORICAL_COLUMNS are label-encoded by
# xgboost_engine before being fed to the model; the rest are already numeric.
FEATURE_COLUMNS: list[str] = [
    "symbol",
    "timeframe",
    "session",
    "day_of_week",
    "hour_of_day",
    "atr",
    "spread",
    "volume",
    "volatility",
    "trend_encoded",
    "bos",
    "choch",
    "order_block",
    "fair_value_gap",
    "liquidity_sweep",
    "risk_reward_planned",
    "confidence_at_entry",
    "strategy_tag_hash",
    "prev_trade_outcome",
    "prev5_win_rate",
    "prev5_avg_rr",
    "prev5_avg_pnl",
    "prev20_win_rate",
    "prev20_avg_rr",
    "prev20_avg_pnl",
    "market_regime",
    "trade_duration_minutes",
]

CATEGORICAL_COLUMNS: list[str] = ["symbol", "timeframe", "session", "market_regime"]

_TREND_ENCODING = {"up": 1, "down": -1, "sideways": 0}
_OUTCOME_ENCODING = {"win": 1, "loss": -1, "breakeven": 0}


def encode_strategy_tags(tags: list[str]) -> int:
    """Order-independent numeric encoding of a strategy tag list."""
    return hash_tags(tags)


def compute_rolling_stats(history: list[TradeRecord], n: int) -> RollingStats:
    """Win rate / avg RR / avg PnL over the last ``n`` closed trades.

    ``history`` must be sorted chronologically ascending (oldest first);
    only the most recent ``n`` entries are used. Returns zeros with
    ``sample_size=0`` when there's no history yet.
    """
    recent = history[-n:] if n > 0 else []
    if not recent:
        return RollingStats(win_rate=0.0, avg_rr=0.0, avg_pnl=0.0, sample_size=0)

    wins = sum(1 for t in recent if t.outcome == "win")
    avg_rr = sum(t.risk_reward_planned for t in recent) / len(recent)
    avg_pnl = sum(t.pnl for t in recent) / len(recent)
    return RollingStats(
        win_rate=wins / len(recent),
        avg_rr=avg_rr,
        avg_pnl=avg_pnl,
        sample_size=len(recent),
    )


def _duration_minutes(record: TradeRecord | CandidateTrade) -> float | None:
    exit_time = getattr(record, "exit_time", None)
    if exit_time is None:
        return None
    delta = exit_time - record.entry_time
    return delta.total_seconds() / 60.0


def _realized_rr(record: TradeRecord | CandidateTrade) -> float | None:
    """Actual risk-reward achieved, used only as a training LABEL.

    Not part of FEATURE_COLUMNS: it is only known after the trade closes,
    so it must never be fed back in as a model input (that would leak the
    outcome). ``risk_reward_planned`` remains the legitimate input feature
    since it is known at entry time.
    """
    if not isinstance(record, TradeRecord):
        return None
    risk = abs(record.entry_price - record.stop_loss)
    if risk <= 0:
        return 0.0
    reward = (
        record.exit_price - record.entry_price
        if record.direction == "buy"
        else record.entry_price - record.exit_price
    )
    return reward / risk


def build_features(
    record: TradeRecord | CandidateTrade,
    history: list[TradeRecord],
    market_regime: str = "unknown",
) -> TradeFeatures:
    """Derive engineered features for a trade record or candidate.

    ``history`` must be the chronological list of the trader's PRIOR
    closed trades (oldest first), not including ``record`` itself.
    ``market_regime`` is computed by ``market_regime.classify_regime`` and
    passed in by the caller — this module intentionally does not import
    that one, keeping the dependency graph acyclic and this function pure.
    """
    entry_time = record.entry_time
    session = get_session(entry_time)

    prev_outcome = 0
    if history:
        prev_outcome = _OUTCOME_ENCODING.get(history[-1].outcome, 0)

    prev5 = compute_rolling_stats(history, 5)
    prev20 = compute_rolling_stats(history, 20)

    is_closed_record = isinstance(record, TradeRecord)
    win: int | None = None
    pnl: float | None = None
    if is_closed_record:
        win = 1 if record.outcome == "win" else 0
        pnl = record.pnl

    volatility = 0.0
    if record.entry_price:
        volatility = record.atr / record.entry_price

    return TradeFeatures(
        trade_id=record.trade_id,
        symbol=record.symbol,
        timeframe=record.timeframe,
        session=session,
        day_of_week=entry_time.weekday(),
        hour_of_day=entry_time.hour,
        atr=record.atr,
        spread=record.spread,
        volume=record.volume,
        volatility=volatility,
        trend_encoded=_TREND_ENCODING.get(record.trend, 0),
        bos=int(record.bos),
        choch=int(record.choch),
        order_block=int(record.order_block),
        fair_value_gap=int(record.fair_value_gap),
        liquidity_sweep=int(record.liquidity_sweep),
        risk_reward_planned=record.risk_reward_planned,
        confidence_at_entry=record.confidence_at_entry or 0.0,
        strategy_tag_hash=encode_strategy_tags(record.strategy_tags),
        prev_trade_outcome=prev_outcome,
        prev5_win_rate=prev5.win_rate,
        prev5_avg_rr=prev5.avg_rr,
        prev5_avg_pnl=prev5.avg_pnl,
        prev20_win_rate=prev20.win_rate,
        prev20_avg_rr=prev20.avg_rr,
        prev20_avg_pnl=prev20.avg_pnl,
        market_regime=market_regime,
        trade_duration_minutes=_duration_minutes(record),
        win=win,
        pnl=pnl,
        realized_rr=_realized_rr(record),
    )


def to_feature_dict(features: TradeFeatures) -> dict:
    """Flatten a TradeFeatures into a plain dict (for DataFrame rows)."""
    return {
        "trade_id": features.trade_id,
        **{col: getattr(features, col) for col in FEATURE_COLUMNS},
        "win": features.win,
        "pnl": features.pnl,
        "realized_rr": features.realized_rr,
    }
