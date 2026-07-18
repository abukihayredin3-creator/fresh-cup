from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

# Chosen so both UPTREND_OHLC (13 bars) and FLAT_OHLC (14 bars) land
# their final bar's hour squarely inside the "ny" session bucket
# (16:00-21:00 UTC), which bridge_config.yaml's default allowed_sessions
# includes — avoids every scenario being rejected by session_not_allowed
# before reaching the check actually under test.
T0 = datetime(2026, 1, 6, 5, 0, tzinfo=timezone.utc)

# Same verified uptrend-BOS zigzag used in test_smc_features.py — two
# confirmed ascending swing highs/lows, decisive breakout on the last bar.
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

# A flat, choppy, low-amplitude sequence with no clean swing structure —
# no BOS/CHOCH/liquidity sweep should fire, leaving direction_bias=None.
FLAT_OHLC = [(100.0, 100.3, 99.8, 100.1) for _ in range(14)]


def _ohlc_payload(rows, start_time=T0):
    return [
        {
            "time": (start_time + timedelta(hours=i)).isoformat(),
            "open": o, "high": h, "low": l, "close": c, "volume": 500,
        }
        for i, (o, h, l, c) in enumerate(rows)
    ]


def _predict_payload(ohlc_rows, **overrides):
    payload = {
        "request_id": "req-1",
        "timestamp": (T0 + timedelta(hours=len(ohlc_rows) - 1)).isoformat(),
        "symbol": "EURUSD",
        "timeframe": "H1",
        "ohlc": _ohlc_payload(ohlc_rows),
        "spread": 5.0,
        "atr": 0.001,
        "account": {
            "balance": 10000.0, "equity": 10000.0, "free_margin": 9500.0,
            "margin_level": 500.0, "open_positions": 0, "open_risk_percent": 0.0,
        },
        "existing_positions": [],
        "point_value": 10.0,
    }
    payload.update(overrides)
    return payload


def test_health_endpoint(bridge_client, tmp_ai_brain_config):
    resp = bridge_client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["ai_brain_enabled"] is True


def test_predict_rejected_by_spread_pre_check(bridge_client):
    payload = _predict_payload(UPTREND_OHLC, spread=999.0)
    resp = bridge_client.post("/predict", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "spread_too_wide"


def test_predict_rejected_symbol_not_allowed(bridge_client):
    payload = _predict_payload(UPTREND_OHLC, symbol="XAUUSD")
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()
    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "symbol_not_allowed"


def test_predict_rejected_insufficient_bar_data(bridge_client):
    payload = _predict_payload(UPTREND_OHLC[:5])
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()
    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "insufficient_bar_data"


def test_predict_rejected_no_directional_signal(bridge_client):
    payload = _predict_payload(FLAT_OHLC)
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()
    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "no_directional_signal"


def test_predict_with_untrained_ai_brain_returns_hold(bridge_client, tmp_ai_brain_config):
    # Real ai_brain, zero trades recorded => no model => graceful HOLD,
    # not a 500 — this is the actual end-to-end path with no stubbing.
    payload = _predict_payload(UPTREND_OHLC)
    resp = bridge_client.post("/predict", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "ai_brain_insufficient_data"


def _fake_ai_decision(**overrides):
    defaults = dict(
        recommendation="favorable",
        final_confidence=0.9,
        data_sufficient=True,
        warnings=[],
        risk_recommendation=SimpleNamespace(recommended_lot_size=0.03, recommended_risk_percent=1.1),
        explanation=SimpleNamespace(summary="Strong favorable setup."),
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_predict_approved_when_ai_brain_favorable(bridge_client, tmp_ai_brain_config, monkeypatch):
    import ai_brain

    monkeypatch.setattr(ai_brain, "get_prediction", lambda candidate, account_risk=None: _fake_ai_decision())

    payload = _predict_payload(UPTREND_OHLC)
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()

    assert body["action"] == "BUY"
    assert body["lot_size"] == 0.03
    assert body["stop_loss"] is not None
    assert body["take_profit"] is not None
    assert body["rejected_reason"] is None

    # And the pending context should now be persisted for /trade_result.
    from bridge import trade_state

    context = trade_state.get_pending_trade("req-1")
    assert context is not None
    assert context.symbol == "EURUSD"


def test_predict_rejected_when_ai_brain_not_favorable(bridge_client, tmp_ai_brain_config, monkeypatch):
    import ai_brain

    monkeypatch.setattr(
        ai_brain, "get_prediction",
        lambda candidate, account_risk=None: _fake_ai_decision(recommendation="unfavorable", final_confidence=0.2),
    )

    payload = _predict_payload(UPTREND_OHLC)
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()

    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "ai_recommendation_not_favorable"


def test_predict_rejected_below_confidence_threshold(bridge_client, tmp_ai_brain_config, monkeypatch):
    import ai_brain

    monkeypatch.setattr(
        ai_brain, "get_prediction",
        lambda candidate, account_risk=None: _fake_ai_decision(recommendation="favorable", final_confidence=0.1),
    )

    payload = _predict_payload(UPTREND_OHLC)
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()

    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "confidence_below_threshold"


def test_predict_reports_ai_brain_disabled_reason(bridge_client, tmp_ai_brain_config, monkeypatch):
    import ai_brain

    monkeypatch.setattr(
        ai_brain, "get_prediction",
        lambda candidate, account_risk=None: _fake_ai_decision(
            data_sufficient=False, warnings=["AI Brain is disabled."], recommendation="neutral", final_confidence=0.0,
        ),
    )

    payload = _predict_payload(UPTREND_OHLC)
    resp = bridge_client.post("/predict", json=payload)
    body = resp.json()

    assert body["action"] == "HOLD"
    assert body["rejected_reason"] == "ai_brain_disabled"


def test_predict_malformed_request_returns_422(bridge_client):
    resp = bridge_client.post("/predict", json={"request_id": "r1"})  # missing required fields
    assert resp.status_code == 422


def test_unhandled_exception_is_logged_and_returns_clean_500(tmp_bridge_config, tmp_ai_brain_config, monkeypatch):
    # TestClient re-raises server exceptions by default; disable that so
    # we can verify the exception_handler actually converts it into a
    # clean JSON 500 rather than propagating to the test itself.
    import logging
    from logging.handlers import RotatingFileHandler
    from pathlib import Path

    from fastapi.testclient import TestClient

    from bridge.app import app
    import ai_brain

    def boom(candidate, account_risk=None):
        raise RuntimeError("simulated unexpected failure")

    monkeypatch.setattr(ai_brain, "get_prediction", boom)

    with TestClient(app, raise_server_exceptions=False) as client:
        payload = _predict_payload(UPTREND_OHLC)
        resp = client.post("/predict", json=payload)

    assert resp.status_code == 500
    assert resp.json() == {"detail": "internal_server_error"}

    # bridge.app's logger is created once (get_logger caches handlers for
    # the process lifetime), so its file handler may point at an earlier
    # test's tmp logs_dir rather than this test's — locate it via the
    # handler itself instead of assuming it matches tmp_bridge_config.
    app_logger = logging.getLogger("bridge.app")
    file_handler = next(h for h in app_logger.handlers if isinstance(h, RotatingFileHandler))
    log_content = Path(file_handler.baseFilename).read_text()

    assert "ERROR" in log_content
    assert "simulated unexpected failure" in log_content
    assert "RuntimeError" in log_content
