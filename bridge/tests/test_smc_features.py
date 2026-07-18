from datetime import datetime, timedelta, timezone

import pytest

from bridge.smc_features import (
    Bar,
    InsufficientDataError,
    _detect_fair_value_gap,
    _detect_liquidity_sweep,
    _is_order_block,
    bars_from_dicts,
    detect,
)

T0 = datetime(2026, 1, 6, 12, 0, tzinfo=timezone.utc)  # a Tuesday, NY session hour


def bar(o, h, l, c, t=T0, v=100.0) -> Bar:
    return Bar(time=t, open=o, high=h, low=l, close=c, volume=v)


def _bars_from_ohlc(rows: list[tuple[float, float, float, float]]) -> list[Bar]:
    return [
        bar(o, h, l, c, t=T0 + timedelta(hours=i))
        for i, (o, h, l, c) in enumerate(rows)
    ]


# A clean zigzag with two confirmed, ascending swing highs (111 -> 116)
# and two confirmed, ascending swing lows (100 -> 105), ending in a
# decisive close above the last confirmed swing high — a textbook
# uptrend-continuation break of structure. Verified against the actual
# swing-detection algorithm (not hand-derived) to avoid arithmetic drift.
UPTREND_OHLC = [
    (100.0, 101.0, 95.0, 100.5),
    (100.5, 106.0, 99.0, 105.0),
    (105.0, 111.0, 104.0, 110.0),   # swing high #1 (111)
    (110.0, 110.5, 103.0, 104.0),
    (104.0, 105.0, 100.0, 101.0),   # swing low #1 (100)
    (101.0, 109.0, 100.5, 108.0),
    (108.0, 116.0, 107.0, 115.0),   # swing high #2 (116)
    (115.0, 115.5, 108.0, 109.0),
    (109.0, 110.0, 105.0, 106.0),   # swing low #2 (105)
    (106.0, 113.0, 105.5, 112.0),
    (112.0, 114.0, 111.0, 113.0),
    (113.0, 118.0, 112.0, 117.0),
    (117.0, 122.0, 116.0, 121.0),   # decisive breakout above 116
]

# Point-mirror of UPTREND_OHLC around 110 with high/low swapped — a
# textbook downtrend-continuation break of structure.
DOWNTREND_OHLC = [(220 - o, 220 - l, 220 - h, 220 - c) for (o, h, l, c) in UPTREND_OHLC]


def test_insufficient_bars_raises():
    bars = _bars_from_ohlc(UPTREND_OHLC[:5])
    with pytest.raises(InsufficientDataError):
        detect(bars)


def test_uptrend_bos_and_buy_bias():
    bars = _bars_from_ohlc(UPTREND_OHLC)
    signals = detect(bars)

    assert signals.trend == "up"
    assert signals.bos is True
    assert signals.choch is False
    assert signals.direction_bias == "buy"
    assert signals.session == "asian"  # last bar lands at 00:00 UTC


def test_downtrend_bos_and_sell_bias():
    bars = _bars_from_ohlc(DOWNTREND_OHLC)
    signals = detect(bars)

    assert signals.trend == "down"
    assert signals.bos is True
    assert signals.choch is False
    assert signals.direction_bias == "sell"


def test_is_order_block_bullish():
    prev = bar(10, 10.2, 8.8, 9)  # bearish candle (close < open)
    last = bar(9, 12.2, 8.8, 12)  # bullish breakout candle
    assert _is_order_block(prev, last) is True


def test_is_order_block_bearish():
    prev = bar(9, 10.2, 8.8, 10)  # bullish candle
    last = bar(10, 10.2, 6.8, 7)  # bearish breakout candle
    assert _is_order_block(prev, last) is True


def test_is_order_block_false_when_same_color():
    prev = bar(9, 10.2, 8.8, 10)  # bullish
    last = bar(10, 12.2, 9.8, 12)  # also bullish, no opposite-color setup
    assert _is_order_block(prev, last) is False


def test_fair_value_gap_bullish():
    bar1 = bar(9, 10, 8, 9.5)
    bar3 = bar(11, 12, 11, 11.5)  # bar1.high(10) < bar3.low(11)
    assert _detect_fair_value_gap(bar1, bar3) is True


def test_fair_value_gap_bearish():
    bar1 = bar(11, 12, 10, 11.5)
    bar3 = bar(8, 9, 7, 8.5)  # bar1.low(10) > bar3.high(9)
    assert _detect_fair_value_gap(bar1, bar3) is True


def test_fair_value_gap_false_when_overlapping():
    bar1 = bar(9, 10, 8, 9.5)
    bar3 = bar(9.2, 9.8, 8.5, 9.6)  # overlaps bar1's range
    assert _detect_fair_value_gap(bar1, bar3) is False


def test_liquidity_sweep_up():
    last = bar(100, 105, 99, 98)  # wicks above 100 but closes back below
    swept_up, swept_down = _detect_liquidity_sweep(last, last_swing_high=100, last_swing_low=90)
    assert swept_up is True
    assert swept_down is False


def test_liquidity_sweep_down():
    last = bar(95, 96, 90, 97)  # wicks below 95 but closes back above
    swept_up, swept_down = _detect_liquidity_sweep(last, last_swing_high=110, last_swing_low=95)
    assert swept_up is False
    assert swept_down is True


def test_liquidity_sweep_neither():
    last = bar(97, 99, 96, 98)
    swept_up, swept_down = _detect_liquidity_sweep(last, last_swing_high=100, last_swing_low=95)
    assert swept_up is False
    assert swept_down is False


def test_bars_from_dicts_parses_iso_time():
    raw = [
        {"time": "2026-01-06T12:00:00+00:00", "open": 1.1, "high": 1.2, "low": 1.0, "close": 1.15, "volume": 500},
    ]
    bars = bars_from_dicts(raw)
    assert len(bars) == 1
    assert bars[0].open == 1.1
    assert bars[0].volume == 500
    assert bars[0].time.year == 2026


def test_bars_from_dicts_defaults_missing_volume():
    raw = [{"time": "2026-01-06T12:00:00+00:00", "open": 1.1, "high": 1.2, "low": 1.0, "close": 1.15}]
    bars = bars_from_dicts(raw)
    assert bars[0].volume == 0.0
