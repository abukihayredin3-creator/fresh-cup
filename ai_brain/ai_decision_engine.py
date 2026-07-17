"""The orchestrator: combines every engine into one advisory AIDecision.

``evaluate_trade`` is the only entry point. It never mutates its input,
never touches MT5, and degrades gracefully (``data_sufficient=False``,
neutral recommendation) whenever a trained model isn't available yet
instead of raising — a brand-new AI Brain with zero trades must still be
safely callable.

``recommendation`` is always one of ``"favorable" | "unfavorable" |
"neutral"`` — an advisory label, never a buy/sell execution signal.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ai_brain import dataset_builder, market_regime, model_manager, pattern_engine, prediction_engine
from ai_brain.confidence_engine import ConfidenceBreakdown, compute_confidence
from ai_brain.config import CONFIG
from ai_brain.explain_ai import Explanation, explain
from ai_brain.feature_engine import CandidateTrade, build_features
from ai_brain.market_regime import RegimeInfo
from ai_brain.pattern_engine import PatternStats
from ai_brain.risk_ai import AccountRiskSettings, RiskRecommendation, recommend as risk_recommend
from ai_brain.utils import get_logger, utcnow
from ai_brain.xgboost_engine import ModelPrediction

logger = get_logger(__name__)


@dataclass
class AIDecision:
    trade_id: str
    generated_at: str
    final_confidence: float
    expected_profit: float
    expected_rr: float
    win_probability: float
    trade_quality: str  # "high" | "medium" | "low" | "insufficient_data"
    recommendation: str  # "favorable" | "unfavorable" | "neutral"
    model_prediction: ModelPrediction | None
    pattern_stats: PatternStats
    regime_info: RegimeInfo
    risk_recommendation: RiskRecommendation
    confidence_breakdown: ConfidenceBreakdown
    explanation: Explanation
    data_sufficient: bool
    warnings: list[str] = field(default_factory=list)


def _classify_regime_for_candidate(candidate: CandidateTrade, history: list) -> RegimeInfo:
    recent = history[-20:]
    volatilities = [t.atr / t.entry_price for t in recent if t.entry_price]
    trend_encodings = [1 if t.trend == "up" else -1 if t.trend == "down" else 0 for t in recent]

    if volatilities:
        return market_regime.classify_regime_from_recent_trades(volatilities, trend_encodings)

    volatility = (candidate.atr / candidate.entry_price) if candidate.entry_price else 0.0
    return market_regime.classify_regime(volatility, trend_strength=0.5)


def evaluate_trade(
    candidate: CandidateTrade,
    history: list | None = None,
    account_risk: AccountRiskSettings | None = None,
) -> AIDecision:
    warnings: list[str] = []

    if history is None:
        history = dataset_builder.get_closed_trades_df_as_records(before=candidate.entry_time)

    regime_info = _classify_regime_for_candidate(candidate, history)
    features = build_features(candidate, history, market_regime=regime_info.regime)

    model_prediction: ModelPrediction | None = None
    data_sufficient = True
    try:
        model_prediction = prediction_engine.predict(features)
    except model_manager.NoModelAvailableError:
        data_sufficient = False
        warnings.append("No trained model available yet; assessment based on historical patterns only.")

    bundle = None
    if model_prediction is not None:
        try:
            bundle = model_manager.load_model()
        except model_manager.NoModelAvailableError:
            bundle = None

    pattern_report = pattern_engine.generate_pattern_report()
    pattern_stats = pattern_engine.lookup_context(features, pattern_report)
    if pattern_stats.sample_size < CONFIG.MIN_SAMPLE_SIZE_FOR_CONFIDENCE:
        warnings.append(
            f"Limited historical sample for this context (n={pattern_stats.sample_size})."
        )

    confidence = compute_confidence(model_prediction, pattern_stats)

    settings = account_risk or AccountRiskSettings(
        account_balance=0.0,
        max_risk_percent=CONFIG.MAX_RISK_PERCENT,
        max_drawdown_percent=0.0,
    )
    risk_recommendation = risk_recommend(
        trade_quality_score=confidence.final_confidence,
        confidence=confidence.final_confidence,
        settings=settings,
        planned_rr=candidate.risk_reward_planned,
        win_probability=model_prediction.win_probability if model_prediction else None,
    )

    if model_prediction is not None:
        win_probability = model_prediction.win_probability
        expected_profit = model_prediction.expected_profit
        expected_rr = model_prediction.expected_rr
    else:
        win_probability = (
            pattern_stats.session_win_rate
            + pattern_stats.symbol_win_rate
            + pattern_stats.timeframe_win_rate
            + pattern_stats.strategy_tag_win_rate
        ) / 4
        expected_profit = 0.0
        expected_rr = candidate.risk_reward_planned

    if not data_sufficient:
        trade_quality = "insufficient_data"
        recommendation = "neutral"
    elif confidence.final_confidence >= CONFIG.QUALITY_FAVORABLE_CONFIDENCE:
        trade_quality = "high"
        recommendation = "favorable"
    elif confidence.final_confidence <= CONFIG.QUALITY_UNFAVORABLE_CONFIDENCE:
        trade_quality = "low"
        recommendation = "unfavorable"
    else:
        trade_quality = "medium"
        recommendation = "neutral"

    explanation = explain(features, model_prediction, pattern_stats, confidence, bundle=bundle)

    return AIDecision(
        trade_id=candidate.trade_id,
        generated_at=utcnow().isoformat(),
        final_confidence=confidence.final_confidence,
        expected_profit=expected_profit,
        expected_rr=expected_rr,
        win_probability=win_probability,
        trade_quality=trade_quality,
        recommendation=recommendation,
        model_prediction=model_prediction,
        pattern_stats=pattern_stats,
        regime_info=regime_info,
        risk_recommendation=risk_recommendation,
        confidence_breakdown=confidence,
        explanation=explanation,
        data_sufficient=data_sufficient,
        warnings=warnings,
    )
