from datetime import datetime, timezone

import pytest

from bridge.tests.conftest import reload_bridge_config, write_bridge_yaml, write_news_blackout_yaml


def test_loads_yaml_values(tmp_bridge_config):
    assert tmp_bridge_config.confidence_threshold == 0.6
    assert tmp_bridge_config.max_open_positions == 3
    assert tmp_bridge_config.allowed_symbols == ["EURUSD", "GBPUSD"]


def test_max_spread_for_known_and_default_symbol(tmp_bridge_config):
    assert tmp_bridge_config.max_spread_for("EURUSD") == 20
    assert tmp_bridge_config.max_spread_for("GBPUSD") == 25  # falls back to default
    assert tmp_bridge_config.max_spread_for("eurusd") == 20  # case-insensitive


def test_is_symbol_allowed(tmp_bridge_config):
    assert tmp_bridge_config.is_symbol_allowed("EURUSD") is True
    assert tmp_bridge_config.is_symbol_allowed("eurusd") is True
    assert tmp_bridge_config.is_symbol_allowed("XAUUSD") is False


def test_empty_allowed_symbols_means_allow_all(tmp_path):
    write_bridge_yaml(tmp_path, execution={"allowed_symbols": []})
    write_news_blackout_yaml(tmp_path)
    config = reload_bridge_config(tmp_path)
    assert config.is_symbol_allowed("ANYTHING") is True


def test_is_session_allowed(tmp_bridge_config):
    assert tmp_bridge_config.is_session_allowed("london") is True
    assert tmp_bridge_config.is_session_allowed("asian") is False


def test_trading_hours_simple_window(tmp_path):
    write_bridge_yaml(tmp_path, execution={"trading_hours": {"start": "08:00", "end": "17:00"}})
    write_news_blackout_yaml(tmp_path)
    config = reload_bridge_config(tmp_path)

    assert config.is_within_trading_hours(datetime(2026, 1, 1, 9, 0)) is True
    assert config.is_within_trading_hours(datetime(2026, 1, 1, 18, 0)) is False


def test_trading_hours_wraps_midnight(tmp_path):
    write_bridge_yaml(tmp_path, execution={"trading_hours": {"start": "22:00", "end": "06:00"}})
    write_news_blackout_yaml(tmp_path)
    config = reload_bridge_config(tmp_path)

    assert config.is_within_trading_hours(datetime(2026, 1, 1, 23, 0)) is True
    assert config.is_within_trading_hours(datetime(2026, 1, 1, 3, 0)) is True
    assert config.is_within_trading_hours(datetime(2026, 1, 1, 12, 0)) is False


def test_active_blackout_window(tmp_path):
    write_bridge_yaml(tmp_path)
    write_news_blackout_yaml(
        tmp_path,
        windows=[
            {
                "symbol": "EURUSD",
                "start_utc": "2026-02-05T12:00:00",
                "end_utc": "2026-02-05T13:00:00",
                "reason": "NFP",
            }
        ],
    )
    config = reload_bridge_config(tmp_path)

    inside = datetime(2026, 2, 5, 12, 30, tzinfo=timezone.utc)
    outside = datetime(2026, 2, 5, 14, 0, tzinfo=timezone.utc)

    assert config.active_blackout("EURUSD", inside) is not None
    assert config.active_blackout("EURUSD", outside) is None
    assert config.active_blackout("GBPUSD", inside) is None  # different symbol


def test_news_filter_disabled_ignores_blackout_windows(tmp_path):
    write_bridge_yaml(tmp_path, news_filter={"enabled": False})
    write_news_blackout_yaml(
        tmp_path,
        windows=[{"symbol": "EURUSD", "start_utc": "2026-02-05T12:00:00", "end_utc": "2026-02-05T13:00:00"}],
    )
    config = reload_bridge_config(tmp_path)

    inside = datetime(2026, 2, 5, 12, 30, tzinfo=timezone.utc)
    assert config.active_blackout("EURUSD", inside) is None


def test_malformed_trading_hours_fails_fast_at_load_time(tmp_path):
    write_bridge_yaml(tmp_path, execution={"trading_hours": {"start": "not-a-time", "end": "23:59"}})
    write_news_blackout_yaml(tmp_path)
    from bridge.config import BridgeConfig

    with pytest.raises(ValueError, match="trading_hours.start"):
        BridgeConfig.from_files(base_dir=tmp_path)


def test_trading_hours_out_of_range_fails_fast(tmp_path):
    write_bridge_yaml(tmp_path, execution={"trading_hours": {"start": "25:00", "end": "23:59"}})
    write_news_blackout_yaml(tmp_path)
    from bridge.config import BridgeConfig

    with pytest.raises(ValueError):
        BridgeConfig.from_files(base_dir=tmp_path)


def test_trading_hours_missing_colon_fails_fast(tmp_path):
    write_bridge_yaml(tmp_path, execution={"trading_hours": {"start": "0800", "end": "23:59"}})
    write_news_blackout_yaml(tmp_path)
    from bridge.config import BridgeConfig

    with pytest.raises(ValueError):
        BridgeConfig.from_files(base_dir=tmp_path)


def test_missing_config_files_fall_back_to_defaults(tmp_path):
    from bridge.config import BridgeConfig

    config = BridgeConfig.from_files(base_dir=tmp_path)  # no YAML files written at all
    assert config.confidence_threshold == 0.6
    assert config.max_open_positions == 3
    assert config.is_symbol_allowed("ANYTHING") is True
