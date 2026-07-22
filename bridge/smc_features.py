"""Deterministic Smart-Money-Concepts structure detection from an OHLC window.

This is where market-structure feature extraction lives — NOT in the EA
(the EA only ever forwards raw OHLC) and NOT in ``ai_brain`` (which only
ever judges already-computed features). It is intentionally mechanical:
fixed rules over price data, not a learned model and not a trading
decision. It only produces the same kind of boolean signals a trading
bot's own analysis would, which ``ai_brain`` then evaluates.

These are documented v1 heuristic definitions of BOS/CHOCH/order
block/FVG/liquidity sweep — simplified but standard readings of each
concept, in the same spirit as ``ai_brain/market_regime.py``'s own
documented heuristic classifier. They are a clear extension point, not a
claim of definitive SMC theory.

Reuses ``ai_brain.utils.get_session`` (not modified, just imported) so
the session labels here are guaranteed to match the buckets the model
was trained on.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ai_brain.utils import get_session

DEFAULT_SWING_WINDOW = 2
MIN_BARS_REQUIRED = 12


class InsufficientDataError(ValueError):
    """Raised when there aren't enough bars to detect structure reliably."""


@dataclass
class Bar:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class StructureSignals:
    trend: str  # "up" | "down" | "sideways"
    bos: bool
    choch: bool
    order_block: bool
    fair_value_gap: bool
    liquidity_sweep: bool
    direction_bias: str | None  # "buy" | "sell" | None
    session: str


def bars_from_dicts(raw: list[dict]) -> list[Bar]:
    """Build ``Bar`` objects from the EA's raw OHLC JSON (chronological,
    oldest first)."""
    return [
        Bar(
            time=b["time"] if isinstance(b["time"], datetime) else datetime.fromisoformat(b["time"]),
            open=float(b["open"]),
            high=float(b["high"]),
            low=float(b["low"]),
            close=float(b["close"]),
            volume=float(b.get("volume", 0.0)),
        )
        for b in raw
    ]


def _find_swing_points(bars: list[Bar], swing_window: int) -> tuple[list[int], list[int]]:
    """Confirmed swing-high and swing-low bar indices (fractal method):
    a swing high at index i has the highest high among
    [i-swing_window, i+swing_window]; symmetric for swing lows. Only
    indices with enough bars on both sides are considered "confirmed" —
    the most recent ``swing_window`` bars can't be confirmed yet.
    """
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    n = len(bars)

    swing_highs, swing_lows = [], []
    for i in range(swing_window, n - swing_window):
        window_highs = highs[i - swing_window : i + swing_window + 1]
        if highs[i] == max(window_highs) and window_highs.count(highs[i]) == 1:
            swing_highs.append(i)

        window_lows = lows[i - swing_window : i + swing_window + 1]
        if lows[i] == min(window_lows) and window_lows.count(lows[i]) == 1:
            swing_lows.append(i)

    return swing_highs, swing_lows


def _detect_trend(bars: list[Bar], swing_highs: list[int], swing_lows: list[int]) -> str:
    """Higher-highs-and-higher-lows => up; lower-highs-and-lower-lows =>
    down; anything else (including too few confirmed swings) falls back
    to comparing recent closes against older ones.
    """
    if len(swing_highs) >= 2 and len(swing_lows) >= 2:
        highs_ascending = bars[swing_highs[-1]].high > bars[swing_highs[-2]].high
        highs_descending = bars[swing_highs[-1]].high < bars[swing_highs[-2]].high
        lows_ascending = bars[swing_lows[-1]].low > bars[swing_lows[-2]].low
        lows_descending = bars[swing_lows[-1]].low < bars[swing_lows[-2]].low

        if highs_ascending and lows_ascending:
            return "up"
        if highs_descending and lows_descending:
            return "down"

    # Fallback: compare the average of the most recent few closes against
    # an earlier window.
    closes = [b.close for b in bars]
    recent = sum(closes[-3:]) / 3
    earlier = sum(closes[-8:-3]) / 5 if len(closes) >= 8 else closes[0]
    if recent > earlier * 1.0005:
        return "up"
    if recent < earlier * 0.9995:
        return "down"
    return "sideways"


def _is_order_block(prev: Bar, last: Bar) -> bool:
    """The last opposite-colored candle before a displacement move is a
    simplified order block: a down-close candle immediately before an
    up-close breakout (bullish order block), or the mirror image."""
    breakout_bullish = last.close > last.open
    prev_bearish = prev.close < prev.open
    prev_bullish = prev.close > prev.open
    if breakout_bullish and prev_bearish:
        return True
    if (not breakout_bullish) and prev_bullish:
        return True
    return False


def _detect_fair_value_gap(bar1: Bar, bar3: Bar) -> bool:
    """3-candle imbalance: bar1's high doesn't reach bar3's low (bullish
    gap) or bar1's low doesn't reach bar3's high (bearish gap) — the
    middle candle didn't fully overlap the outer two."""
    return bar1.high < bar3.low or bar1.low > bar3.high


def _detect_liquidity_sweep(last: Bar, last_swing_high: float | None, last_swing_low: float | None) -> tuple[bool, bool]:
    """Returns (swept_up, swept_down): price wicks beyond a recent swing
    point but closes back inside it — a stop-hunt / liquidity grab."""
    swept_up = last_swing_high is not None and last.high > last_swing_high and last.close < last_swing_high
    swept_down = last_swing_low is not None and last.low < last_swing_low and last.close > last_swing_low
    return swept_up, swept_down


def detect(bars: list[Bar], swing_window: int = DEFAULT_SWING_WINDOW) -> StructureSignals:
    """Detect market structure signals from the most recent bar in
    ``bars`` (chronological, oldest first — the last element is "now").
    """
    if len(bars) < MIN_BARS_REQUIRED:
        raise InsufficientDataError(
            f"Need at least {MIN_BARS_REQUIRED} bars to detect structure, got {len(bars)}."
        )

    swing_highs, swing_lows = _find_swing_points(bars, swing_window)
    trend = _detect_trend(bars, swing_highs, swing_lows)

    last_swing_high = bars[swing_highs[-1]].high if swing_highs else None
    last_swing_low = bars[swing_lows[-1]].low if swing_lows else None

    last = bars[-1]

    bos = False
    choch = False
    if last_swing_high is not None and trend == "up" and last.close > last_swing_high:
        bos = True
    elif last_swing_low is not None and trend == "down" and last.close < last_swing_low:
        bos = True
    elif last_swing_low is not None and trend == "up" and last.close < last_swing_low:
        choch = True
    elif last_swing_high is not None and trend == "down" and last.close > last_swing_high:
        choch = True

    order_block = (bos or choch) and len(bars) >= 2 and _is_order_block(bars[-2], last)

    fair_value_gap = len(bars) >= 3 and _detect_fair_value_gap(bars[-3], last)

    liquidity_sweep_up, liquidity_sweep_down = _detect_liquidity_sweep(last, last_swing_high, last_swing_low)
    liquidity_sweep = liquidity_sweep_up or liquidity_sweep_down

    direction_bias: str | None = None
    if bos and trend == "up":
        direction_bias = "buy"
    elif bos and trend == "down":
        direction_bias = "sell"
    elif choch and trend == "up":
        direction_bias = "sell"
    elif choch and trend == "down":
        direction_bias = "buy"
    elif liquidity_sweep_up:
        direction_bias = "sell"  # swept highs and rejected => bearish
    elif liquidity_sweep_down:
        direction_bias = "buy"  # swept lows and rejected => bullish

    return StructureSignals(
        trend=trend,
        bos=bos,
        choch=choch,
        order_block=order_block,
        fair_value_gap=fair_value_gap,
        liquidity_sweep=liquidity_sweep,
        direction_bias=direction_bias,
        session=get_session(last.time),
    )
