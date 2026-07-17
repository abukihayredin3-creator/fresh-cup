import pytest

from ai_brain.market_regime import (
    REGIME_QUIET,
    REGIME_RANGING,
    REGIME_TRENDING,
    REGIME_UNKNOWN,
    REGIME_VOLATILE,
    classify_regime,
)


@pytest.mark.parametrize(
    "volatility, trend_strength, expected",
    [
        (0.0, 0.0, REGIME_UNKNOWN),
        (0.01, 0.8, REGIME_TRENDING),
        (0.01, 0.1, REGIME_VOLATILE),
        (0.001, 0.1, REGIME_QUIET),
        (0.004, 0.6, REGIME_TRENDING),
    ],
)
def test_classify_regime_table(volatility, trend_strength, expected):
    result = classify_regime(volatility, trend_strength)
    assert result.regime == expected


def test_classify_regime_confidence_bounds():
    result = classify_regime(0.01, 0.9)
    assert 0.0 <= result.regime_confidence <= 1.0
