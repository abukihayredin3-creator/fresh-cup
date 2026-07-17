"""Explains every prediction: why confidence moved, feature importance,
historical evidence, pattern matches, and a probability breakdown.

Feature importance defaults to XGBoost's built-in gain-based
``feature_importances_`` — magnitude-only, not signed per-instance,
since that's what a global importance score actually is. When
``CONFIG.USE_SHAP`` is enabled and the optional ``shap`` package is
installed, per-instance signed contributions are used instead, giving a
genuine "this feature pushed the prediction up/down" direction. SHAP is
kept out of the core requirements (heavy dependency chain) and is
opt-in, with a graceful fallback to built-in importances if it isn't
installed.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from ai_brain.config import CONFIG
from ai_brain.confidence_engine import ConfidenceBreakdown
from ai_brain.feature_engine import TradeFeatures, to_feature_dict
from ai_brain.pattern_engine import PatternStats
from ai_brain.utils import get_logger
from ai_brain.xgboost_engine import ModelBundle, ModelPrediction, prepare_matrix

logger = get_logger(__name__)


@dataclass
class FeatureContribution:
    feature: str
    importance: float
    direction: str  # "increases" | "decreases" | "influential" (magnitude-only)


@dataclass
class Explanation:
    summary: str
    confidence_drivers: list[str] = field(default_factory=list)
    top_features: list[FeatureContribution] = field(default_factory=list)
    historical_evidence: list[str] = field(default_factory=list)
    pattern_matches: list[str] = field(default_factory=list)
    probability_breakdown: dict = field(default_factory=dict)


def feature_importance_builtin(bundle: ModelBundle, top_n: int) -> list[FeatureContribution]:
    """Public helper: global gain-based feature importance for a bundle,
    independent of any specific candidate trade. Used by explain() and
    directly by telegram_bot's /feature_importance command."""
    importances = getattr(bundle.classifier, "feature_importances_", None)
    if importances is None:
        return []
    pairs = sorted(zip(bundle.feature_columns, importances), key=lambda p: p[1], reverse=True)
    return [
        FeatureContribution(feature=f, importance=float(imp), direction="influential")
        for f, imp in pairs[:top_n]
    ]


def _top_features_shap(bundle: ModelBundle, features: TradeFeatures, top_n: int) -> list[FeatureContribution] | None:
    try:
        import shap  # type: ignore
    except ImportError:
        logger.warning("AI_BRAIN_USE_SHAP is enabled but the 'shap' package is not installed; "
                        "falling back to built-in feature importances.")
        return None

    row_df = pd.DataFrame([to_feature_dict(features)])
    X, _ = prepare_matrix(row_df, bundle.feature_columns, encoders=bundle.encoders, fit_encoders=False)

    explainer = shap.TreeExplainer(bundle.classifier)
    shap_values = explainer.shap_values(X)
    values = shap_values[0] if hasattr(shap_values, "__len__") else shap_values

    pairs = sorted(zip(bundle.feature_columns, values), key=lambda p: abs(p[1]), reverse=True)
    return [
        FeatureContribution(
            feature=f, importance=float(abs(v)), direction="increases" if v > 0 else "decreases"
        )
        for f, v in pairs[:top_n]
    ]


def _feature_importance(bundle: ModelBundle | None, features: TradeFeatures) -> list[FeatureContribution]:
    if bundle is None:
        return []

    top_n = CONFIG.EXPLAIN_TOP_N_FEATURES
    if CONFIG.USE_SHAP:
        result = _top_features_shap(bundle, features, top_n)
        if result is not None:
            return result

    return feature_importance_builtin(bundle, top_n)


def explain(
    features: TradeFeatures,
    model_prediction: ModelPrediction | None,
    pattern_stats: PatternStats,
    confidence: ConfidenceBreakdown,
    bundle: ModelBundle | None = None,
) -> Explanation:
    top_features = _feature_importance(bundle, features)

    historical_evidence = [
        f"Session '{features.session}' historical win rate: {pattern_stats.session_win_rate:.0%}",
        f"Symbol '{features.symbol}' historical win rate: {pattern_stats.symbol_win_rate:.0%}",
        f"Timeframe '{features.timeframe}' historical win rate: {pattern_stats.timeframe_win_rate:.0%}",
        f"Strategy tag combination historical win rate: {pattern_stats.strategy_tag_win_rate:.0%}",
        f"Based on {pattern_stats.sample_size} comparable historical trade(s).",
    ]

    pattern_matches = list(pattern_stats.matched_patterns)
    if pattern_stats.high_risk_flags:
        pattern_matches += [f"WARNING - high-risk pattern: {flag}" for flag in pattern_stats.high_risk_flags]

    if model_prediction is not None:
        probability_breakdown = {
            "win_probability": model_prediction.win_probability,
            "loss_probability": model_prediction.loss_probability,
            "expected_rr": model_prediction.expected_rr,
            "expected_profit": model_prediction.expected_profit,
            "model_version": model_prediction.model_version,
        }
    else:
        probability_breakdown = {"status": "no_trained_model_yet"}

    confidence_drivers = list(confidence.notes)

    quality_word = (
        "favorable" if confidence.final_confidence >= CONFIG.QUALITY_FAVORABLE_CONFIDENCE
        else "unfavorable" if confidence.final_confidence <= CONFIG.QUALITY_UNFAVORABLE_CONFIDENCE
        else "neutral"
    )
    top_feature_note = f", most influenced by '{top_features[0].feature}'" if top_features else ""
    summary = (
        f"{quality_word.capitalize()} setup at {confidence.final_confidence:.0%} confidence "
        f"({confidence.model_component:.0%} model, {confidence.historical_component:.0%} historical)"
        f"{top_feature_note}."
    )

    return Explanation(
        summary=summary,
        confidence_drivers=confidence_drivers,
        top_features=top_features,
        historical_evidence=historical_evidence,
        pattern_matches=pattern_matches,
        probability_breakdown=probability_breakdown,
    )
