from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from bridge import translator
from bridge.schemas import AccountInfo, OhlcBar, PredictRequest, TradeResultRequest
from bridge.smc_features import StructureSignals
from bridge.trade_state import PendingTradeContext

T0 = datetime(2026, 1, 6, 12, 0, tzinfo=timezone.utc)


def _request(**overrides) -> PredictRequest:
    defaults = dict(
        request_id="req-1",
        timestamp=T0,
        symbol="EURUSD",
        timeframe="H1",
        ohlc=[OhlcBar(time=T0, open=1.10, high=1.102, low=1.098, close=1.101, volume=500)],
        spread=1.2,
        atr=0.001,
        account=AccountInfo(balance=10000, equity=10000, free_margin=9500, open_positions=0),
        point_value=10.0,
    )
    defaults.update(overrides)
    return PredictRequest(**defaults)


def _signals(**overrides) -> StructureSignals:
    defaults = dict(
        trend="up",
        bos=True,
        choch=False,
        order_block=True,
        fair_value_gap=False,
        liquidity_sweep=False,
        direction_bias="buy",
        session="london",
    )
    defaults.update(overrides)
    return StructureSignals(**defaults)


def _fake_decision(**overrides):
    """A duck-typed stand-in for ai_brain.AIDecision — translator.py only
    touches final_confidence, risk_recommendation.{recommended_lot_size,
    recommended_risk_percent}, and explanation.summary, so a
    SimpleNamespace is a faithful, low-ceremony substitute for these tests."""
    defaults = dict(
        final_confidence=0.75,
        risk_recommendation=SimpleNamespace(recommended_lot_size=0.05, recommended_risk_percent=1.2),
        explanation=SimpleNamespace(summary="Favorable setup at 75% confidence."),
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_build_candidate_trade_buy_direction(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="buy")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)

    assert candidate.trade_id == "req-1"
    assert candidate.direction == "buy"
    assert candidate.entry_price == 1.101
    assert candidate.stop_loss < candidate.entry_price
    assert candidate.take_profit > candidate.entry_price
    assert candidate.risk_reward_planned == tmp_bridge_config.default_rr


def test_build_candidate_trade_sell_direction(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="sell", trend="down", bos=True)
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)

    assert candidate.direction == "sell"
    assert candidate.stop_loss > candidate.entry_price
    assert candidate.take_profit < candidate.entry_price


def test_build_candidate_trade_raises_without_direction(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias=None, bos=False, choch=False)
    with pytest.raises(ValueError):
        translator.build_candidate_trade(request, signals, tmp_bridge_config)


def test_strategy_tags_reflect_signals(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="buy", bos=True, order_block=True, fair_value_gap=True)
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)

    assert "trend_continuation" in candidate.strategy_tags
    assert "order_block" in candidate.strategy_tags
    assert "fair_value_gap" in candidate.strategy_tags
    assert "reversal" not in candidate.strategy_tags


def test_strategy_tags_fallback_when_no_signals_true(tmp_bridge_config):
    request = _request()
    signals = _signals(bos=False, choch=False, order_block=False, fair_value_gap=False, liquidity_sweep=False)
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)
    assert candidate.strategy_tags == ["structure_signal"]


def test_build_account_risk_settings_uses_point_value(tmp_bridge_config):
    request = _request(point_value=10.0)
    signals = _signals(direction_bias="buy")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)

    settings = translator.build_account_risk_settings(request, candidate, tmp_bridge_config)
    assert settings.point_value == 10.0
    assert settings.stop_loss_distance_points is not None
    assert settings.bot_provided_lot_size is None


def test_build_account_risk_settings_missing_point_value_is_none(tmp_bridge_config):
    request = _request(point_value=0.0)
    signals = _signals(direction_bias="buy")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)

    settings = translator.build_account_risk_settings(request, candidate, tmp_bridge_config)
    assert settings.point_value is None


def test_hold_response_shape():
    resp = translator.hold_response("req-9", "spread_too_wide")
    assert resp.action == "HOLD"
    assert resp.rejected_reason == "spread_too_wide"
    assert resp.lot_size is None


def test_approved_response_uses_ai_recommended_lot_size(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="buy")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)
    decision = _fake_decision(risk_recommendation=SimpleNamespace(recommended_lot_size=0.05, recommended_risk_percent=1.0))

    resp = translator.approved_response("req-1", candidate, decision, tmp_bridge_config)
    assert resp.action == "BUY"
    assert resp.lot_size == 0.05
    assert resp.stop_loss == candidate.stop_loss
    assert resp.take_profit == candidate.take_profit


def test_approved_response_sell_action(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="sell", trend="down")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)
    decision = _fake_decision()

    resp = translator.approved_response("req-1", candidate, decision, tmp_bridge_config)
    assert resp.action == "SELL"


def test_approved_response_falls_back_to_default_lot_when_ai_has_none(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="buy")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)
    decision = _fake_decision(risk_recommendation=SimpleNamespace(recommended_lot_size=None, recommended_risk_percent=1.0))

    resp = translator.approved_response("req-1", candidate, decision, tmp_bridge_config)
    assert resp.lot_size == tmp_bridge_config.default_lot


def test_approved_response_clamps_lot_size_to_config_bounds(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="buy")
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)
    decision = _fake_decision(risk_recommendation=SimpleNamespace(recommended_lot_size=999.0, recommended_risk_percent=1.0))

    resp = translator.approved_response("req-1", candidate, decision, tmp_bridge_config)
    assert resp.lot_size == tmp_bridge_config.max_lot


def test_context_from_candidate_round_trip(tmp_bridge_config):
    request = _request()
    signals = _signals(direction_bias="buy", bos=True)
    candidate = translator.build_candidate_trade(request, signals, tmp_bridge_config)
    decision = _fake_decision(final_confidence=0.66)

    context = translator.context_from_candidate(candidate, decision)
    assert context.trade_id == candidate.trade_id
    assert context.bos is True
    assert context.confidence_at_entry == 0.66
    assert context.strategy_tags == candidate.strategy_tags


def _trade_result(**overrides) -> TradeResultRequest:
    defaults = dict(
        trade_id="t-1",
        symbol="EURUSD",
        timeframe="H1",
        direction="buy",
        entry_time=T0,
        exit_time=T0,
        entry_price=1.10,
        exit_price=1.105,
        stop_loss=1.098,
        take_profit=1.106,
        lot_size=0.05,
        atr=0.001,
        spread=1.2,
        volume=500,
        pnl=25.0,
        outcome="win",
        exit_reason="tp",
        duration_seconds=3600,
        max_favorable_excursion=30.0,
        max_adverse_excursion=-5.0,
        drawdown=5.0,
    )
    defaults.update(overrides)
    return TradeResultRequest(**defaults)


def test_build_trade_record_uses_pending_context():
    result = _trade_result()
    context = PendingTradeContext(
        trade_id="t-1",
        symbol="EURUSD",
        timeframe="H1",
        direction="buy",
        trend="up",
        bos=True,
        choch=False,
        order_block=True,
        fair_value_gap=False,
        liquidity_sweep=False,
        strategy_tags=["trend_continuation", "order_block"],
        risk_reward_planned=2.0,
        confidence_at_entry=0.7,
    )

    record = translator.build_trade_record(result, context)

    assert record.trend == "up"
    assert record.bos is True
    assert record.strategy_tags == ["trend_continuation", "order_block"]
    assert record.risk_reward_planned == 2.0
    assert record.confidence_at_entry == 0.7
    assert record.pnl == 25.0
    assert record.outcome == "win"

    import json

    notes = json.loads(record.notes)
    assert notes["exit_reason"] == "tp"
    assert notes["max_favorable_excursion"] == 30.0
    assert notes["max_adverse_excursion"] == -5.0
    assert notes["drawdown"] == 5.0
    assert notes["duration_seconds"] == 3600


def test_refine_rejection_reason_detects_disabled_warning():
    from bridge import risk_gate

    decision = _fake_decision(warnings=["AI Brain is disabled."])
    reason = translator.refine_rejection_reason(risk_gate.REASON_AI_INSUFFICIENT_DATA, decision)
    assert reason == "ai_brain_disabled"


def test_refine_rejection_reason_leaves_other_reasons_untouched():
    from bridge import risk_gate

    decision = _fake_decision(warnings=["Limited historical sample."])
    reason = translator.refine_rejection_reason(risk_gate.REASON_AI_INSUFFICIENT_DATA, decision)
    assert reason == risk_gate.REASON_AI_INSUFFICIENT_DATA

    reason2 = translator.refine_rejection_reason(risk_gate.REASON_CONFIDENCE_BELOW_THRESHOLD, decision)
    assert reason2 == risk_gate.REASON_CONFIDENCE_BELOW_THRESHOLD


def test_build_trade_record_without_context_uses_safe_defaults():
    result = _trade_result()
    record = translator.build_trade_record(result, context=None)

    assert record.trend == "sideways"
    assert record.bos is False
    assert record.strategy_tags == ["unknown_context"]
    assert record.confidence_at_entry is None
    assert record.risk_reward_planned > 0
