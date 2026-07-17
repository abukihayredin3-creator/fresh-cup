from ai_brain.confidence_engine import compute_confidence
from ai_brain.pattern_engine import PatternStats
from ai_brain.xgboost_engine import ModelPrediction


def _pattern_stats(**overrides) -> PatternStats:
    defaults = dict(
        session_win_rate=0.5,
        symbol_win_rate=0.5,
        timeframe_win_rate=0.5,
        strategy_tag_win_rate=0.5,
        sample_size=0,
        matched_patterns=[],
        high_risk_flags=[],
    )
    defaults.update(overrides)
    return PatternStats(**defaults)


def test_no_model_available_uses_historical_only():
    stats = _pattern_stats(session_win_rate=0.8, symbol_win_rate=0.8, timeframe_win_rate=0.8, strategy_tag_win_rate=0.8, sample_size=100)
    breakdown = compute_confidence(None, stats)
    assert breakdown.model_component == 0.0
    assert breakdown.final_confidence > 0.0


def test_coin_flip_stats_yield_low_historical_component():
    stats = _pattern_stats(sample_size=100)  # all win rates at 0.5
    breakdown = compute_confidence(None, stats)
    assert breakdown.historical_component == 0.0
    assert breakdown.final_confidence == 0.0


def test_zero_sample_size_penalizes_confidence():
    stats = _pattern_stats(session_win_rate=0.9, symbol_win_rate=0.9, timeframe_win_rate=0.9, strategy_tag_win_rate=0.9, sample_size=0)
    breakdown = compute_confidence(None, stats)
    assert breakdown.sample_size_penalty == 0.0
    assert breakdown.final_confidence == 0.0


def test_model_prediction_blends_with_historical():
    stats = _pattern_stats(session_win_rate=0.9, symbol_win_rate=0.9, timeframe_win_rate=0.9, strategy_tag_win_rate=0.9, sample_size=100)
    prediction = ModelPrediction(
        win_probability=0.9, loss_probability=0.1, expected_rr=2.0, expected_profit=50.0,
        model_confidence=0.8, model_version="v1",
    )
    breakdown = compute_confidence(prediction, stats)
    assert breakdown.model_component == 0.8
    assert 0.0 < breakdown.final_confidence <= 1.0


def test_final_confidence_always_clipped_0_1():
    stats = _pattern_stats(session_win_rate=1.0, symbol_win_rate=1.0, timeframe_win_rate=1.0, strategy_tag_win_rate=1.0, sample_size=1000)
    prediction = ModelPrediction(
        win_probability=1.0, loss_probability=0.0, expected_rr=5.0, expected_profit=500.0,
        model_confidence=1.0, model_version="v1",
    )
    breakdown = compute_confidence(prediction, stats)
    assert breakdown.final_confidence <= 1.0
