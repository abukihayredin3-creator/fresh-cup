from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from bridge.config import BridgeConfig


def write_bridge_yaml(base_dir: Path, **overrides) -> None:
    """Write config/bridge_config.yaml under ``base_dir`` with ``overrides``
    deep-merged onto sane defaults, for tests that need non-default
    execution rules."""
    config_dir = base_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)

    data = {
        "server": {"host": "127.0.0.1", "port": 8000},
        "risk": {
            "max_risk_percent": 2.0,
            "default_lot": 0.01,
            "min_lot": 0.01,
            "max_lot": 1.0,
            "sl_atr_multiplier": 1.5,
            "default_rr": 2.0,
        },
        "execution": {
            "confidence_threshold": 0.6,
            "max_open_positions": 3,
            "max_spread_points": {"default": 25, "EURUSD": 20},
            "allowed_symbols": ["EURUSD", "GBPUSD"],
            "allowed_sessions": ["london", "london_ny_overlap", "ny"],
            "trading_hours": {"start": "00:00", "end": "23:59"},
        },
        "news_filter": {"enabled": True},
        "log_level": "INFO",
    }
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(data.get(key), dict):
            data[key].update(value)
        else:
            data[key] = value

    with open(config_dir / "bridge_config.yaml", "w") as f:
        yaml.safe_dump(data, f)


def write_news_blackout_yaml(base_dir: Path, windows: list[dict] | None = None) -> None:
    config_dir = base_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    with open(config_dir / "news_blackout.yaml", "w") as f:
        yaml.safe_dump({"blackout_windows": windows or []}, f)


@pytest.fixture
def tmp_bridge_config(tmp_path, monkeypatch):
    """Point bridge.config.CONFIG at an isolated tmp directory.

    Writes default YAML files so behavior matches the real shipped
    config unless the test writes its own via ``write_bridge_yaml``/
    ``write_news_blackout_yaml`` before requesting this fixture reloads.
    """
    from bridge import config as config_module

    write_bridge_yaml(tmp_path)
    write_news_blackout_yaml(tmp_path)

    fresh = BridgeConfig.from_files(base_dir=tmp_path)
    for key, value in vars(fresh).items():
        setattr(config_module.CONFIG, key, value)

    yield config_module.CONFIG


@pytest.fixture
def tmp_ai_brain_config(tmp_path):
    """Isolate ai_brain's own CONFIG into a subdirectory of the same
    tmp_path used for bridge isolation, so end-to-end bridge tests
    exercise the real ai_brain package without touching real
    data/models/logs. ai_brain is never modified — this only points its
    existing test-isolation hook (AIBrainConfig(base_dir=...)) at a tmp
    dir, the same technique ai_brain's own tests/conftest.py uses.
    """
    from ai_brain.config import CONFIG as AI_BRAIN_CONFIG
    from ai_brain.config import AIBrainConfig
    from ai_brain.utils import ensure_directories

    fresh = AIBrainConfig(base_dir=tmp_path / "ai_brain_data")
    for key, value in vars(fresh).items():
        setattr(AI_BRAIN_CONFIG, key, value)
    AI_BRAIN_CONFIG.AI_BRAIN_ENABLED = True
    ensure_directories()
    yield AI_BRAIN_CONFIG


@pytest.fixture
def bridge_client(tmp_bridge_config, tmp_ai_brain_config):
    """A TestClient against the real FastAPI app, with both the bridge
    and ai_brain fully isolated into per-test tmp directories."""
    from fastapi.testclient import TestClient

    from bridge.app import app

    with TestClient(app) as client:
        yield client


def reload_bridge_config(tmp_path) -> BridgeConfig:
    """Re-read YAML from ``tmp_path`` and apply it to the live CONFIG
    singleton — use after a test rewrites the YAML files mid-test."""
    from bridge import config as config_module

    fresh = BridgeConfig.from_files(base_dir=tmp_path)
    for key, value in vars(fresh).items():
        setattr(config_module.CONFIG, key, value)
    return config_module.CONFIG
