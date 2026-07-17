"""Market regime classification.

Classifies the current market context (trending / ranging / volatile /
quiet) from volatility and trend signals already available on a trade
record. Used both as a feature input and as contextual info for the
decision engine. Thresholds are config-tunable bands, not hardcoded
trading rules.
"""

from __future__ import annotations

from dataclasses import dataclass

REGIME_TRENDING = "trending"
REGIME_RANGING = "ranging"
REGIME_VOLATILE = "volatile"
REGIME_QUIET = "quiet"
REGIME_UNKNOWN = "unknown"

# Volatility (ATR / price) bands. Tunable, not magic: these are the
# defaults for a v1 heuristic classifier and can be overridden by passing
# explicit thresholds to classify_regime.
DEFAULT_HIGH_VOLATILITY = 0.008
DEFAULT_LOW_VOLATILITY = 0.002
DEFAULT_TREND_STRENGTH = 0.5  # |trend_encoded|-like strength signal, 0..1


@dataclass
class RegimeInfo:
    regime: str
    regime_confidence: float


def classify_regime(
    volatility: float,
    trend_strength: float = 0.0,
    high_volatility: float = DEFAULT_HIGH_VOLATILITY,
    low_volatility: float = DEFAULT_LOW_VOLATILITY,
    trend_threshold: float = DEFAULT_TREND_STRENGTH,
) -> RegimeInfo:
    """Classify a market regime from volatility and trend strength.

    ``volatility`` is a scale-free proxy such as ATR / price.
    ``trend_strength`` is 0..1, e.g. derived from how consistently recent
    candles moved in one direction; 0 means no directional bias.
    """
    if volatility <= 0:
        return RegimeInfo(regime=REGIME_UNKNOWN, regime_confidence=0.0)

    is_high_vol = volatility >= high_volatility
    is_low_vol = volatility <= low_volatility
    is_trending = trend_strength >= trend_threshold

    if is_high_vol and is_trending:
        return RegimeInfo(regime=REGIME_TRENDING, regime_confidence=min(1.0, trend_strength))
    if is_high_vol and not is_trending:
        return RegimeInfo(regime=REGIME_VOLATILE, regime_confidence=min(1.0, volatility / high_volatility))
    if is_low_vol and not is_trending:
        return RegimeInfo(regime=REGIME_QUIET, regime_confidence=min(1.0, low_volatility / max(volatility, 1e-9)))
    if is_trending:
        return RegimeInfo(regime=REGIME_TRENDING, regime_confidence=min(1.0, trend_strength))
    return RegimeInfo(regime=REGIME_RANGING, regime_confidence=0.5)


def classify_regime_from_recent_trades(volatilities: list[float], trend_encodings: list[int]) -> RegimeInfo:
    """Convenience wrapper: classify regime from recent trades' raw signals.

    ``trend_strength`` is derived as the fraction of recent trades sharing
    the majority trend direction (0.5 = no bias, 1.0 = fully aligned).
    """
    if not volatilities:
        return RegimeInfo(regime=REGIME_UNKNOWN, regime_confidence=0.0)

    avg_volatility = sum(volatilities) / len(volatilities)

    if trend_encodings:
        up = sum(1 for t in trend_encodings if t > 0)
        down = sum(1 for t in trend_encodings if t < 0)
        majority = max(up, down)
        trend_strength = majority / len(trend_encodings)
    else:
        trend_strength = 0.0

    return classify_regime(avg_volatility, trend_strength)
