from datetime import datetime, timezone

import pytest

from bridge import risk_gate
from bridge.config import BridgeConfig
from bridge.tests.conftest import reload_bridge_config, write_bridge_yaml, write_news_blackout_yaml

NOON = datetime(2026, 1, 6, 12, 0, tzinfo=timezone.utc)


def test_pre_checks_all_pass(tmp_bridge_config):
    result = risk_gate.pre_checks(
        tmp_bridge_config, symbol="EURUSD", session="london", timestamp=NOON, spread=5.0, open_positions=0
    )
    assert result.approved is True
    assert result.rejected_reason is None


def test_pre_checks_symbol_not_allowed(tmp_bridge_config):
    result = risk_gate.pre_checks(
        tmp_bridge_config, symbol="XAUUSD", session="london", timestamp=NOON, spread=5.0, open_positions=0
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_SYMBOL_NOT_ALLOWED


def test_pre_checks_session_not_allowed(tmp_bridge_config):
    result = risk_gate.pre_checks(
        tmp_bridge_config, symbol="EURUSD", session="asian", timestamp=NOON, spread=5.0, open_positions=0
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_SESSION_NOT_ALLOWED


def test_pre_checks_max_positions_reached(tmp_bridge_config):
    result = risk_gate.pre_checks(
        tmp_bridge_config, symbol="EURUSD", session="london", timestamp=NOON, spread=5.0, open_positions=3
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_MAX_POSITIONS_REACHED


def test_pre_checks_spread_too_wide(tmp_bridge_config):
    result = risk_gate.pre_checks(
        tmp_bridge_config, symbol="EURUSD", session="london", timestamp=NOON, spread=25.0, open_positions=0
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_SPREAD_TOO_WIDE


def test_pre_checks_outside_trading_hours(tmp_path):
    write_bridge_yaml(tmp_path, execution={"trading_hours": {"start": "08:00", "end": "17:00"}})
    write_news_blackout_yaml(tmp_path)
    config = reload_bridge_config(tmp_path)

    result = risk_gate.pre_checks(
        config,
        symbol="EURUSD",
        session="london",
        timestamp=datetime(2026, 1, 6, 20, 0, tzinfo=timezone.utc),
        spread=5.0,
        open_positions=0,
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_OUTSIDE_TRADING_HOURS


def test_pre_checks_news_blackout(tmp_path):
    write_bridge_yaml(tmp_path)
    write_news_blackout_yaml(
        tmp_path,
        windows=[{"symbol": "EURUSD", "start_utc": "2026-01-06T11:30:00", "end_utc": "2026-01-06T12:30:00"}],
    )
    config = reload_bridge_config(tmp_path)

    result = risk_gate.pre_checks(
        config, symbol="EURUSD", session="london", timestamp=NOON, spread=5.0, open_positions=0
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_NEWS_BLACKOUT


def test_pre_checks_priority_order_symbol_first(tmp_bridge_config):
    # Symbol not allowed AND session not allowed AND max positions —
    # symbol_not_allowed should win since it's checked first.
    result = risk_gate.pre_checks(
        tmp_bridge_config, symbol="XAUUSD", session="asian", timestamp=NOON, spread=5.0, open_positions=99
    )
    assert result.rejected_reason == risk_gate.REASON_SYMBOL_NOT_ALLOWED


def test_post_checks_all_pass(tmp_bridge_config):
    result = risk_gate.post_checks(
        tmp_bridge_config, recommendation="favorable", final_confidence=0.8, data_sufficient=True
    )
    assert result.approved is True


def test_post_checks_insufficient_data(tmp_bridge_config):
    result = risk_gate.post_checks(
        tmp_bridge_config, recommendation="neutral", final_confidence=0.0, data_sufficient=False
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_AI_INSUFFICIENT_DATA


def test_post_checks_not_favorable(tmp_bridge_config):
    result = risk_gate.post_checks(
        tmp_bridge_config, recommendation="unfavorable", final_confidence=0.9, data_sufficient=True
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_AI_NOT_FAVORABLE


def test_post_checks_confidence_below_threshold(tmp_bridge_config):
    result = risk_gate.post_checks(
        tmp_bridge_config, recommendation="favorable", final_confidence=0.3, data_sufficient=True
    )
    assert result.approved is False
    assert result.rejected_reason == risk_gate.REASON_CONFIDENCE_BELOW_THRESHOLD


def test_post_checks_never_approves_unfavorable_regardless_of_confidence(tmp_bridge_config):
    # High confidence cannot override an "unfavorable" recommendation —
    # the gate never overrides ai_brain's judgment upward.
    result = risk_gate.post_checks(
        tmp_bridge_config, recommendation="unfavorable", final_confidence=0.99, data_sufficient=True
    )
    assert result.approved is False
