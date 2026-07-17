"""Blends model confidence with historical/statistical confidence.

A pure function of already-computed inputs — it does not import
``prediction_engine`` or ``pattern_engine`` itself, which keeps the
dependency graph acyclic (the orchestrator, ``ai_decision_engine``,
assembles those inputs and passes them in) and makes this module
trivially unit-testable with hand-built dataclasses.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ai_brain.config import CONFIG
from ai_brain.pattern_engine import PatternStats
from ai_brain.xgboost_engine import ModelPrediction


@dataclass
class ConfidenceBreakdown:
    final_confidence: float
    model_component: float
    historical_component: float
    sample_size_penalty: float
    notes: list[str] = field(default_factory=list)


def _historical_component(pattern_stats: PatternStats) -> float:
    win_rates = [
        pattern_stats.session_win_rate,
        pattern_stats.symbol_win_rate,
        pattern_stats.timeframe_win_rate,
        pattern_stats.strategy_tag_win_rate,
    ]
    # Distance from 0.5 (coin-flip) maps a win rate to a confidence-like
    # signal: a 70% or a 30% historical win rate are both strong signals
    # (favor taking, or strongly avoiding, this kind of setup).
    return sum(abs(wr - 0.5) * 2 for wr in win_rates) / len(win_rates)


def compute_confidence(
    model_prediction: ModelPrediction | None,
    pattern_stats: PatternStats,
) -> ConfidenceBreakdown:
    historical_component = _historical_component(pattern_stats)
    sample_size_penalty = min(1.0, pattern_stats.sample_size / max(1, CONFIG.MIN_SAMPLE_SIZE_FOR_CONFIDENCE))

    notes = [
        f"Historical win-rate signal across session/symbol/timeframe/tags: {historical_component:.2f}",
        f"Sample-size penalty: {sample_size_penalty:.2f} (n={pattern_stats.sample_size}, "
        f"needs {CONFIG.MIN_SAMPLE_SIZE_FOR_CONFIDENCE} for full weight)",
    ]

    if model_prediction is None:
        # No trained model yet: confidence rests entirely on historical
        # evidence rather than being artificially crushed by a zeroed-out
        # model component.
        final_confidence = historical_component * sample_size_penalty
        notes.append("No trained model available yet; confidence based on historical evidence only.")
        return ConfidenceBreakdown(
            final_confidence=max(0.0, min(1.0, final_confidence)),
            model_component=0.0,
            historical_component=historical_component,
            sample_size_penalty=sample_size_penalty,
            notes=notes,
        )

    model_component = model_prediction.model_confidence
    notes.append(f"Model confidence: {model_component:.2f} (model {model_prediction.model_version})")

    final_confidence = (
        CONFIG.CONFIDENCE_MODEL_WEIGHT * model_component
        + CONFIG.CONFIDENCE_HISTORY_WEIGHT * historical_component * sample_size_penalty
    )
    final_confidence = max(0.0, min(1.0, final_confidence))

    return ConfidenceBreakdown(
        final_confidence=final_confidence,
        model_component=model_component,
        historical_component=historical_component,
        sample_size_penalty=sample_size_penalty,
        notes=notes,
    )
