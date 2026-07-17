"""MMXM AI Brain v1.0 — public interface.

This is the ONLY contract a trading bot needs to integrate with:

    import ai_brain

    ai_brain.record_trade(trade)                 # call when a trade closes
    decision = ai_brain.get_prediction(candidate) # call for advisory intelligence

Both functions are exception-safe boundaries: nothing raised inside the
AI Brain is ever allowed to propagate to the caller. A bug or missing
model here must never be able to break the trading bot, whether the AI
Brain is enabled or not. Disable it entirely at any time with
``ai_brain.disable()`` and the trading bot keeps working untouched.
"""

from __future__ import annotations

from ai_brain import dataset_builder, learning_manager, model_trainer
from ai_brain.ai_decision_engine import AIDecision, evaluate_trade
from ai_brain.config import CONFIG
from ai_brain.confidence_engine import ConfidenceBreakdown
from ai_brain.explain_ai import Explanation
from ai_brain.feature_engine import CandidateTrade, TradeFeatures, TradeRecord
from ai_brain.market_regime import REGIME_UNKNOWN, RegimeInfo
from ai_brain.pattern_engine import PatternStats
from ai_brain.risk_ai import AccountRiskSettings, RiskRecommendation
from ai_brain.utils import get_logger, utcnow

logger = get_logger(__name__)

__all__ = [
    "is_enabled",
    "enable",
    "disable",
    "record_trade",
    "get_prediction",
    "TradeRecord",
    "CandidateTrade",
    "TradeFeatures",
    "AIDecision",
    "AccountRiskSettings",
]


def is_enabled() -> bool:
    return CONFIG.AI_BRAIN_ENABLED


def enable() -> None:
    CONFIG.AI_BRAIN_ENABLED = True
    logger.info("AI Brain enabled.")


def disable() -> None:
    CONFIG.AI_BRAIN_ENABLED = False
    logger.info("AI Brain disabled; the trading bot continues unaffected.")


def _neutral_decision(candidate: CandidateTrade, reason: str) -> AIDecision:
    """A safe, fully-populated but non-committal decision for whenever the
    AI Brain can't (or shouldn't) produce a real assessment."""
    pattern_stats = PatternStats(
        session_win_rate=0.5,
        symbol_win_rate=0.5,
        timeframe_win_rate=0.5,
        strategy_tag_win_rate=0.5,
        sample_size=0,
        matched_patterns=[],
        high_risk_flags=[],
    )
    regime_info = RegimeInfo(regime=REGIME_UNKNOWN, regime_confidence=0.0)
    confidence = ConfidenceBreakdown(
        final_confidence=0.0,
        model_component=0.0,
        historical_component=0.0,
        sample_size_penalty=0.0,
        notes=[reason],
    )
    risk_recommendation = RiskRecommendation(
        recommended_risk_percent=CONFIG.MIN_RISK_PERCENT,
        recommended_lot_size=None,
        recommended_rr=candidate.risk_reward_planned,
        max_risk_percent_allowed=CONFIG.MAX_RISK_PERCENT,
        rationale=reason,
        capped=False,
    )
    explanation = Explanation(
        summary=reason,
        confidence_drivers=[reason],
        top_features=[],
        historical_evidence=[],
        pattern_matches=[],
        probability_breakdown={"status": "unavailable"},
    )

    return AIDecision(
        trade_id=candidate.trade_id,
        generated_at=utcnow().isoformat(),
        final_confidence=0.0,
        expected_profit=0.0,
        expected_rr=candidate.risk_reward_planned,
        win_probability=0.5,
        trade_quality="insufficient_data",
        recommendation="neutral",
        model_prediction=None,
        pattern_stats=pattern_stats,
        regime_info=regime_info,
        risk_recommendation=risk_recommendation,
        confidence_breakdown=confidence,
        explanation=explanation,
        data_sufficient=False,
        warnings=[reason],
    )


def record_trade(trade: TradeRecord) -> None:
    """Feed a CLOSED trade into the AI Brain's learning loop.

    No-op if the AI Brain is disabled. Never raises: any internal failure
    is logged and swallowed, since a bug here must never be able to break
    the calling trading bot.
    """
    if not is_enabled():
        return

    try:
        dataset_builder.append_closed_trade(trade)
        learning_manager.record_actual_outcome(trade.trade_id, trade.outcome, trade.pnl)
        model_trainer.on_trade_recorded()
        model_trainer.maybe_retrain()
    except Exception:
        logger.exception("record_trade failed for trade %s.", trade.trade_id)


def get_prediction(
    candidate_trade: CandidateTrade,
    account_risk: AccountRiskSettings | None = None,
) -> AIDecision:
    """Get advisory intelligence for a candidate trade.

    Never raises: returns a safe neutral ``AIDecision`` (with
    ``data_sufficient=False``) if the AI Brain is disabled, has no
    trained model yet, or hits an internal error.
    """
    if not is_enabled():
        return _neutral_decision(candidate_trade, reason="AI Brain is disabled.")

    try:
        return evaluate_trade(candidate_trade, account_risk=account_risk)
    except Exception:
        logger.exception("get_prediction failed for trade %s.", candidate_trade.trade_id)
        return _neutral_decision(candidate_trade, reason="AI Brain encountered an internal error.")
