"""The execution-rule gate — the "Risk Manager" mentioned in the spec.

Two passes:

* ``pre_checks`` run BEFORE calling ``ai_brain`` at all (session/trading
  hours, allowed symbol, spread, max open positions, news blackout) —
  cheap, deterministic, and there's no reason to ask the AI to judge a
  trade that structurally can't be taken anyway.
* ``post_checks`` run AFTER ``ai_brain`` returns its ``AIDecision``
  (confidence threshold + ``recommendation == "favorable"``).

This module never imports ``ai_brain`` — it only knows about the
bridge's own config and plain values passed in, which keeps it fully
testable in isolation. It can only ever turn a favorable AI
recommendation into a rejection; it can never turn an unfavorable one
into an approval.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from bridge.config import BridgeConfig

# Reasons produced by this module. (A couple of additional reasons —
# "no_directional_signal", "ai_brain_disabled" — are set directly by the
# orchestration flow in translator.py/app.py, since they depend on
# smc_features/ai_brain outcomes this module deliberately doesn't know
# about.)
REASON_SYMBOL_NOT_ALLOWED = "symbol_not_allowed"
REASON_OUTSIDE_TRADING_HOURS = "outside_trading_hours"
REASON_SESSION_NOT_ALLOWED = "session_not_allowed"
REASON_MAX_POSITIONS_REACHED = "max_positions_reached"
REASON_SPREAD_TOO_WIDE = "spread_too_wide"
REASON_NEWS_BLACKOUT = "news_blackout"
REASON_AI_INSUFFICIENT_DATA = "ai_brain_insufficient_data"
REASON_AI_NOT_FAVORABLE = "ai_recommendation_not_favorable"
REASON_CONFIDENCE_BELOW_THRESHOLD = "confidence_below_threshold"


@dataclass
class GateResult:
    approved: bool
    rejected_reason: str | None = None


def pre_checks(
    config: BridgeConfig,
    symbol: str,
    session: str,
    timestamp: datetime,
    spread: float,
    open_positions: int,
) -> GateResult:
    """Cheap structural checks that don't require calling ai_brain."""
    if not config.is_symbol_allowed(symbol):
        return GateResult(False, REASON_SYMBOL_NOT_ALLOWED)

    if not config.is_within_trading_hours(timestamp):
        return GateResult(False, REASON_OUTSIDE_TRADING_HOURS)

    if not config.is_session_allowed(session):
        return GateResult(False, REASON_SESSION_NOT_ALLOWED)

    if open_positions >= config.max_open_positions:
        return GateResult(False, REASON_MAX_POSITIONS_REACHED)

    if spread > config.max_spread_for(symbol):
        return GateResult(False, REASON_SPREAD_TOO_WIDE)

    if config.active_blackout(symbol, timestamp) is not None:
        return GateResult(False, REASON_NEWS_BLACKOUT)

    return GateResult(True)


def post_checks(
    config: BridgeConfig,
    recommendation: str,
    final_confidence: float,
    data_sufficient: bool,
) -> GateResult:
    """Checks against the AIDecision ai_brain returned."""
    if not data_sufficient:
        return GateResult(False, REASON_AI_INSUFFICIENT_DATA)

    if recommendation != "favorable":
        return GateResult(False, REASON_AI_NOT_FAVORABLE)

    if final_confidence < config.confidence_threshold:
        return GateResult(False, REASON_CONFIDENCE_BELOW_THRESHOLD)

    return GateResult(True)
