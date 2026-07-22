"""The JSON contract between the MT5 EA and the bridge.

Pydantic models here only validate *shape* (types, required fields).
Business rules (minimum bar count, confidence thresholds, spread limits)
live in ``smc_features``/``risk_gate`` — this module's job stops at "is
this a well-formed request".
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class OhlcBar(BaseModel):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = Field(default=0.0, ge=0)


class ExistingPosition(BaseModel):
    ticket: int
    symbol: str
    direction: Literal["buy", "sell"]
    lot_size: float = Field(gt=0)
    open_price: float
    sl: float = 0.0
    tp: float = 0.0
    profit: float = 0.0

    @field_validator("direction", mode="before")
    @classmethod
    def _lower_direction(cls, v: str) -> str:
        return v.lower() if isinstance(v, str) else v


class AccountInfo(BaseModel):
    balance: float
    equity: float
    # free_margin/margin_level can legitimately go negative during a
    # margin call, so they're intentionally left unconstrained.
    free_margin: float
    margin_level: float = 0.0
    open_positions: int = Field(default=0, ge=0)
    open_risk_percent: float = 0.0


class PredictRequest(BaseModel):
    """EA -> bridge, ``POST /predict``. No direction, no SMC flags — the
    bridge derives all of that from ``ohlc`` via ``smc_features``."""

    request_id: str
    timestamp: datetime
    symbol: str
    timeframe: str
    ohlc: list[OhlcBar]
    spread: float = Field(ge=0)
    # A zero or negative ATR would produce a degenerate stop_loss ==
    # entry_price (or, worse, an inverted stop) once translator.py
    # multiplies it out — reject it here at the API boundary instead of
    # letting it propagate. This also rejects NaN (NaN > 0 is always
    # False in IEEE-754, so Pydantic's gt=0 check correctly fails it —
    # Python's json module otherwise accepts literal NaN/Infinity tokens
    # as a non-standard extension).
    atr: float = Field(gt=0)
    account: AccountInfo
    existing_positions: list[ExistingPosition] = Field(default_factory=list)
    # Monetary value of a 1.0 price-unit move per standard lot for this
    # symbol (MT5: SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE) scaled
    # to a per-point basis) — needed to convert ai_brain's risk-percent
    # recommendation into a concrete lot size. Optional: 0.0 means "unknown",
    # and the bridge falls back to the configured default lot size.
    point_value: float = 0.0

    @field_validator("symbol", mode="before")
    @classmethod
    def _upper_symbol(cls, v: str) -> str:
        return v.upper() if isinstance(v, str) else v


class PredictResponse(BaseModel):
    """Bridge -> EA. ``action`` is the only thing the EA acts on;
    everything else is for logging/telemetry on the EA side."""

    request_id: str
    action: Literal["BUY", "SELL", "HOLD"]
    confidence: float
    lot_size: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    risk_percent: float | None = None
    explanation: str = ""
    rejected_reason: str | None = None


class TradeResultRequest(BaseModel):
    """EA -> bridge, ``POST /trade_result``, sent from
    ``OnTradeTransaction`` when a position closes. Only fields the EA
    actually knows at close time — the original SMC/candidate context
    (trend, bos, choch, strategy tags, planned RR/confidence) is
    recalled from ``trade_state`` by ``trade_id``, not resent here.
    """

    trade_id: str
    symbol: str
    timeframe: str
    direction: Literal["buy", "sell"]
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    lot_size: float = Field(gt=0)
    atr: float = Field(ge=0)
    spread: float = Field(ge=0)
    volume: float = Field(ge=0)
    pnl: float
    outcome: Literal["win", "loss", "breakeven"]
    exit_reason: str = "unknown"  # "tp" | "sl" | "manual" | "timeout" | "unknown"
    duration_seconds: float = 0.0
    max_favorable_excursion: float = 0.0
    max_adverse_excursion: float = 0.0
    drawdown: float = 0.0

    @field_validator("symbol", mode="before")
    @classmethod
    def _upper_symbol(cls, v: str) -> str:
        return v.upper() if isinstance(v, str) else v

    @field_validator("direction", mode="before")
    @classmethod
    def _lower_direction(cls, v: str) -> str:
        return v.lower() if isinstance(v, str) else v


class TradeResultResponse(BaseModel):
    trade_id: str
    recorded: bool
    message: str = ""


class HealthResponse(BaseModel):
    status: str = "ok"
    ai_brain_enabled: bool
