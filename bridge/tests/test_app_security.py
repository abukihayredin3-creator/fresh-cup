"""Tests for the optional X-API-Key gate on /predict and /trade_result."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from bridge.tests.conftest import reload_bridge_config, write_bridge_yaml, write_news_blackout_yaml

T0 = datetime(2026, 1, 6, 5, 0, tzinfo=timezone.utc)

UPTREND_OHLC = [
    (100.0, 101.0, 95.0, 100.5),
    (100.5, 106.0, 99.0, 105.0),
    (105.0, 111.0, 104.0, 110.0),
    (110.0, 110.5, 103.0, 104.0),
    (104.0, 105.0, 100.0, 101.0),
    (101.0, 109.0, 100.5, 108.0),
    (108.0, 116.0, 107.0, 115.0),
    (115.0, 115.5, 108.0, 109.0),
    (109.0, 110.0, 105.0, 106.0),
    (106.0, 113.0, 105.5, 112.0),
    (112.0, 114.0, 111.0, 113.0),
    (113.0, 118.0, 112.0, 117.0),
    (117.0, 122.0, 116.0, 121.0),
]


def _predict_payload():
    return {
        "request_id": "req-sec-1",
        "timestamp": (T0 + timedelta(hours=len(UPTREND_OHLC) - 1)).isoformat(),
        "symbol": "EURUSD",
        "timeframe": "H1",
        "ohlc": [
            {"time": (T0 + timedelta(hours=i)).isoformat(), "open": o, "high": h, "low": l, "close": c, "volume": 500}
            for i, (o, h, l, c) in enumerate(UPTREND_OHLC)
        ],
        "spread": 5.0,
        "atr": 0.001,
        "account": {
            "balance": 10000.0, "equity": 10000.0, "free_margin": 9500.0,
            "margin_level": 500.0, "open_positions": 0, "open_risk_percent": 0.0,
        },
        "existing_positions": [],
        "point_value": 10.0,
    }


def _client_with_api_key(tmp_path, api_key: str):
    write_bridge_yaml(tmp_path, security={"api_key": api_key})
    write_news_blackout_yaml(tmp_path)
    reload_bridge_config(tmp_path)

    from bridge.app import app

    return TestClient(app)


def test_no_api_key_configured_allows_requests_without_header(tmp_bridge_config, tmp_ai_brain_config):
    from bridge.app import app

    with TestClient(app) as client:
        resp = client.post("/predict", json=_predict_payload())
    assert resp.status_code == 200


def test_api_key_configured_rejects_missing_header(tmp_path, tmp_ai_brain_config):
    with _client_with_api_key(tmp_path, "s3cret") as client:
        resp = client.post("/predict", json=_predict_payload())
    assert resp.status_code == 401


def test_api_key_configured_rejects_wrong_header(tmp_path, tmp_ai_brain_config):
    with _client_with_api_key(tmp_path, "s3cret") as client:
        resp = client.post("/predict", json=_predict_payload(), headers={"X-API-Key": "wrong"})
    assert resp.status_code == 401


def test_api_key_configured_accepts_correct_header(tmp_path, tmp_ai_brain_config):
    with _client_with_api_key(tmp_path, "s3cret") as client:
        resp = client.post("/predict", json=_predict_payload(), headers={"X-API-Key": "s3cret"})
    assert resp.status_code == 200


def test_health_endpoint_never_requires_api_key(tmp_path, tmp_ai_brain_config):
    with _client_with_api_key(tmp_path, "s3cret") as client:
        resp = client.get("/health")
    assert resp.status_code == 200


def test_trade_result_also_gated_by_api_key(tmp_path, tmp_ai_brain_config):
    payload = {
        "trade_id": "t-sec-1", "symbol": "EURUSD", "timeframe": "H1", "direction": "buy",
        "entry_time": T0.isoformat(), "exit_time": (T0 + timedelta(hours=1)).isoformat(),
        "entry_price": 1.10, "exit_price": 1.105, "stop_loss": 1.098, "take_profit": 1.106,
        "lot_size": 0.05, "atr": 0.001, "spread": 1.2, "volume": 500, "pnl": 25.0, "outcome": "win",
    }
    with _client_with_api_key(tmp_path, "s3cret") as client:
        rejected = client.post("/trade_result", json=payload)
        assert rejected.status_code == 401

        accepted = client.post("/trade_result", json=payload, headers={"X-API-Key": "s3cret"})
        assert accepted.status_code == 200
