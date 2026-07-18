"""Translates between the EA's wire format and ai_brain's contract.

Three jobs:

1. Build an ``ai_brain.CandidateTrade`` from a validated request plus the
   structure signals ``smc_features`` detected — including the concrete
   stop_loss/take_profit levels ai_brain itself never computes (it only
   returns ratios/probabilities). This is mechanical ATR-multiple unit
   conversion, not a strategic decision.
2. Turn an ``ai_brain.AIDecision`` into a ``PredictResponse`` — BUY/SELL
   with a concrete lot size (ai_brain's own recommendation when it can
   compute one, else the configured default), or HOLD with a reason.
3. Rebuild a complete ``ai_brain.TradeRecord`` from a closed-trade report
   plus the originally-saved ``PendingTradeContext`` — folding the fields
   ``TradeRecord`` doesn't have (exit_reason, MFE, MAE, drawdown) into its
   free-text ``notes`` field as JSON, since ai_brain itself is never
   modified.
"""

from __future__ import annotations

import json

from ai_brain import AccountRiskSettings, AIDecision, CandidateTrade, TradeRecord

from bridge.config import BridgeConfig
from bridge.schemas import PredictRequest, PredictResponse, TradeResultRequest
from bridge.smc_features import StructureSignals
from bridge.trade_state import PendingTradeContext

_STRATEGY_TAG_MAP = (
    ("bos", "trend_continuation"),
    ("choch", "reversal"),
    ("order_block", "order_block"),
    ("fair_value_gap", "fair_value_gap"),
    ("liquidity_sweep", "liquidity_sweep"),
)


def _strategy_tags_from_signals(signals: StructureSignals) -> list[str]:
    tags = [label for attr, label in _STRATEGY_TAG_MAP if getattr(signals, attr)]
    return tags or ["structure_signal"]


def build_candidate_trade(
    request: PredictRequest,
    signals: StructureSignals,
    config: BridgeConfig,
) -> CandidateTrade:
    """Build the candidate ai_brain will judge. ``signals.direction_bias``
    must not be None — callers check that before reaching here (a candidate
    always needs a direction to evaluate)."""
    direction = signals.direction_bias
    if direction is None:
        raise ValueError("Cannot build a candidate trade without a directional bias.")

    entry_price = request.ohlc[-1].close
    volume = request.ohlc[-1].volume

    sl_distance = request.atr * config.sl_atr_multiplier
    if direction == "buy":
        stop_loss = entry_price - sl_distance
        take_profit = entry_price + sl_distance * config.default_rr
    else:
        stop_loss = entry_price + sl_distance
        take_profit = entry_price - sl_distance * config.default_rr

    return CandidateTrade(
        trade_id=request.request_id,
        symbol=request.symbol,
        timeframe=request.timeframe,
        direction=direction,
        entry_time=request.timestamp,
        entry_price=entry_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        atr=request.atr,
        spread=request.spread,
        volume=volume,
        trend=signals.trend,
        bos=signals.bos,
        choch=signals.choch,
        order_block=signals.order_block,
        fair_value_gap=signals.fair_value_gap,
        liquidity_sweep=signals.liquidity_sweep,
        strategy_tags=_strategy_tags_from_signals(signals),
        risk_reward_planned=config.default_rr,
        confidence_at_entry=None,
    )


def build_account_risk_settings(
    request: PredictRequest,
    candidate: CandidateTrade,
    config: BridgeConfig,
) -> AccountRiskSettings:
    stop_distance = abs(candidate.entry_price - candidate.stop_loss)
    return AccountRiskSettings(
        account_balance=request.account.balance,
        max_risk_percent=config.max_risk_percent,
        max_drawdown_percent=0.0,
        current_drawdown_percent=0.0,
        bot_provided_lot_size=None,  # let ai_brain's risk_ai compute one from risk% + stop distance
        stop_loss_distance_points=stop_distance if stop_distance > 0 else None,
        point_value=request.point_value if request.point_value > 0 else None,
    )


def hold_response(request_id: str, reason: str, confidence: float = 0.0, explanation: str = "") -> PredictResponse:
    return PredictResponse(
        request_id=request_id,
        action="HOLD",
        confidence=confidence,
        explanation=explanation or reason,
        rejected_reason=reason,
    )


def approved_response(
    request_id: str,
    candidate: CandidateTrade,
    decision: AIDecision,
    config: BridgeConfig,
) -> PredictResponse:
    """Build the BUY/SELL response for a trade that passed every gate."""
    action = "BUY" if candidate.direction == "buy" else "SELL"

    lot_size = decision.risk_recommendation.recommended_lot_size
    if lot_size is None:
        lot_size = config.default_lot
    lot_size = max(config.min_lot, min(config.max_lot, lot_size))

    return PredictResponse(
        request_id=request_id,
        action=action,
        confidence=decision.final_confidence,
        lot_size=lot_size,
        stop_loss=candidate.stop_loss,
        take_profit=candidate.take_profit,
        risk_percent=decision.risk_recommendation.recommended_risk_percent,
        explanation=decision.explanation.summary,
        rejected_reason=None,
    )


def context_from_candidate(candidate: CandidateTrade, decision: AIDecision) -> PendingTradeContext:
    """What to remember about an approved candidate so /trade_result can
    later rebuild a complete TradeRecord."""
    return PendingTradeContext(
        trade_id=candidate.trade_id,
        symbol=candidate.symbol,
        timeframe=candidate.timeframe,
        direction=candidate.direction,
        trend=candidate.trend,
        bos=candidate.bos,
        choch=candidate.choch,
        order_block=candidate.order_block,
        fair_value_gap=candidate.fair_value_gap,
        liquidity_sweep=candidate.liquidity_sweep,
        strategy_tags=candidate.strategy_tags,
        risk_reward_planned=candidate.risk_reward_planned,
        confidence_at_entry=decision.final_confidence,
    )


def build_trade_record(result: TradeResultRequest, context: PendingTradeContext | None) -> TradeRecord:
    """Rebuild a complete ai_brain.TradeRecord from the EA's close-time
    report plus the originally-saved candidate context (if any).

    ``exit_reason``/duration/MFE/MAE/drawdown have no field on
    ``TradeRecord`` (ai_brain is never modified) — they're folded into
    ``notes`` as JSON instead.
    """
    notes = json.dumps(
        {
            "exit_reason": result.exit_reason,
            "duration_seconds": result.duration_seconds,
            "max_favorable_excursion": result.max_favorable_excursion,
            "max_adverse_excursion": result.max_adverse_excursion,
            "drawdown": result.drawdown,
        }
    )

    if context is not None:
        trend = context.trend
        bos, choch = context.bos, context.choch
        order_block, fair_value_gap = context.order_block, context.fair_value_gap
        liquidity_sweep = context.liquidity_sweep
        strategy_tags = context.strategy_tags
        risk_reward_planned = context.risk_reward_planned
        confidence_at_entry = context.confidence_at_entry
    else:
        # No pending context (e.g. bridge process restarted between
        # approval and close, or the trade wasn't opened through this
        # bridge at all) — record with honest "unknown" defaults rather
        # than dropping the feedback entirely.
        trend = "sideways"
        bos = choch = order_block = fair_value_gap = liquidity_sweep = False
        strategy_tags = ["unknown_context"]
        stop_distance = abs(result.entry_price - result.stop_loss)
        reward_distance = abs(result.take_profit - result.entry_price)
        risk_reward_planned = (reward_distance / stop_distance) if stop_distance > 0 else 1.0
        confidence_at_entry = None

    return TradeRecord(
        trade_id=result.trade_id,
        symbol=result.symbol,
        timeframe=result.timeframe,
        direction=result.direction,
        entry_time=result.entry_time,
        exit_time=result.exit_time,
        entry_price=result.entry_price,
        exit_price=result.exit_price,
        stop_loss=result.stop_loss,
        take_profit=result.take_profit,
        lot_size=result.lot_size,
        atr=result.atr,
        spread=result.spread,
        volume=result.volume,
        trend=trend,
        bos=bos,
        choch=choch,
        order_block=order_block,
        fair_value_gap=fair_value_gap,
        liquidity_sweep=liquidity_sweep,
        strategy_tags=strategy_tags,
        risk_reward_planned=risk_reward_planned,
        confidence_at_entry=confidence_at_entry,
        pnl=result.pnl,
        outcome=result.outcome,
        is_closed=True,
        notes=notes,
    )
