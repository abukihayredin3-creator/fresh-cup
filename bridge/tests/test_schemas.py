import pytest
from pydantic import ValidationError

from bridge.schemas import (
    AccountInfo,
    ExistingPosition,
    HealthResponse,
    OhlcBar,
    PredictRequest,
    PredictResponse,
    TradeResultRequest,
)


def _valid_predict_payload() -> dict:
    return {
        "request_id": "req-1",
        "timestamp": "2026-01-06T12:00:00Z",
        "symbol": "eurusd",
        "timeframe": "H1",
        "ohlc": [
            {"time": "2026-01-06T11:00:00Z", "open": 1.1, "high": 1.12, "low": 1.09, "close": 1.11, "volume": 500},
        ],
        "spread": 1.2,
        "atr": 0.0012,
        "account": {
            "balance": 10000.0,
            "equity": 10050.0,
            "free_margin": 9800.0,
            "margin_level": 500.0,
            "open_positions": 1,
            "open_risk_percent": 0.8,
        },
        "existing_positions": [
            {
                "ticket": 123,
                "symbol": "EURUSD",
                "direction": "BUY",
                "lot_size": 0.1,
                "open_price": 1.1,
                "sl": 1.09,
                "tp": 1.12,
                "profit": 5.0,
            }
        ],
    }


def test_predict_request_parses_and_normalizes_symbol():
    req = PredictRequest.model_validate(_valid_predict_payload())
    assert req.symbol == "EURUSD"  # uppercased
    assert req.existing_positions[0].direction == "buy"  # lowercased
    assert isinstance(req.ohlc[0], OhlcBar)
    assert isinstance(req.account, AccountInfo)


def test_predict_request_missing_required_field_raises():
    payload = _valid_predict_payload()
    del payload["atr"]
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_predict_request_rejects_bad_position_direction():
    payload = _valid_predict_payload()
    payload["existing_positions"][0]["direction"] = "sideways"
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_predict_request_accepts_empty_ohlc_and_positions():
    payload = _valid_predict_payload()
    payload["ohlc"] = []
    payload["existing_positions"] = []
    req = PredictRequest.model_validate(payload)
    assert req.ohlc == []
    assert req.existing_positions == []


def test_predict_response_action_must_be_known_literal():
    with pytest.raises(ValidationError):
        PredictResponse.model_validate({"request_id": "r1", "action": "MAYBE", "confidence": 0.5})


def test_predict_response_hold_allows_null_fields():
    resp = PredictResponse.model_validate(
        {"request_id": "r1", "action": "HOLD", "confidence": 0.0, "rejected_reason": "spread_too_wide"}
    )
    assert resp.lot_size is None
    assert resp.stop_loss is None
    assert resp.rejected_reason == "spread_too_wide"


def _valid_trade_result_payload() -> dict:
    return {
        "trade_id": "t-1",
        "symbol": "gbpusd",
        "timeframe": "H1",
        "direction": "SELL",
        "entry_time": "2026-01-06T10:00:00Z",
        "exit_time": "2026-01-06T11:30:00Z",
        "entry_price": 1.25,
        "exit_price": 1.248,
        "stop_loss": 1.253,
        "take_profit": 1.245,
        "lot_size": 0.05,
        "atr": 0.001,
        "spread": 1.0,
        "volume": 400.0,
        "pnl": 10.0,
        "outcome": "win",
        "exit_reason": "tp",
        "duration_seconds": 5400,
        "max_favorable_excursion": 12.0,
        "max_adverse_excursion": -3.0,
        "drawdown": 3.0,
    }


def test_trade_result_request_parses_and_normalizes():
    req = TradeResultRequest.model_validate(_valid_trade_result_payload())
    assert req.symbol == "GBPUSD"
    assert req.direction == "sell"
    assert req.outcome == "win"


def test_trade_result_request_rejects_bad_outcome():
    payload = _valid_trade_result_payload()
    payload["outcome"] = "pending"
    with pytest.raises(ValidationError):
        TradeResultRequest.model_validate(payload)


def test_trade_result_request_defaults_for_optional_fields():
    payload = _valid_trade_result_payload()
    for key in ("exit_reason", "duration_seconds", "max_favorable_excursion", "max_adverse_excursion", "drawdown"):
        del payload[key]
    req = TradeResultRequest.model_validate(payload)
    assert req.exit_reason == "unknown"
    assert req.duration_seconds == 0.0


def test_predict_request_rejects_zero_atr():
    payload = _valid_predict_payload()
    payload["atr"] = 0.0
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_predict_request_rejects_negative_atr():
    payload = _valid_predict_payload()
    payload["atr"] = -0.001
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_predict_request_rejects_nan_atr():
    payload = _valid_predict_payload()
    payload["atr"] = float("nan")
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_predict_request_rejects_negative_spread():
    payload = _valid_predict_payload()
    payload["spread"] = -1.0
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_predict_request_rejects_zero_lot_size_on_existing_position():
    payload = _valid_predict_payload()
    payload["existing_positions"][0]["lot_size"] = 0.0
    with pytest.raises(ValidationError):
        PredictRequest.model_validate(payload)


def test_trade_result_request_rejects_zero_lot_size():
    payload = _valid_trade_result_payload()
    payload["lot_size"] = 0.0
    with pytest.raises(ValidationError):
        TradeResultRequest.model_validate(payload)


def test_trade_result_request_rejects_negative_atr():
    payload = _valid_trade_result_payload()
    payload["atr"] = -0.001
    with pytest.raises(ValidationError):
        TradeResultRequest.model_validate(payload)


def test_health_response_defaults():
    resp = HealthResponse(ai_brain_enabled=True)
    assert resp.status == "ok"
    assert resp.ai_brain_enabled is True
