from datetime import datetime, timezone

from bridge import trade_state
from bridge.trade_state import PendingTradeContext

T0 = datetime(2026, 1, 6, 17, 0, tzinfo=timezone.utc)


def _trade_result_payload(**overrides) -> dict:
    payload = {
        "trade_id": "t-close-1",
        "symbol": "eurusd",
        "timeframe": "H1",
        "direction": "buy",
        "entry_time": T0.isoformat(),
        "exit_time": (T0.replace(hour=18)).isoformat(),
        "entry_price": 1.10,
        "exit_price": 1.105,
        "stop_loss": 1.098,
        "take_profit": 1.106,
        "lot_size": 0.05,
        "atr": 0.001,
        "spread": 1.2,
        "volume": 500,
        "pnl": 25.0,
        "outcome": "win",
        "exit_reason": "tp",
        "duration_seconds": 3600,
        "max_favorable_excursion": 30.0,
        "max_adverse_excursion": -5.0,
        "drawdown": 5.0,
    }
    payload.update(overrides)
    return payload


def test_trade_result_with_pending_context_records_and_cleans_up(bridge_client, tmp_ai_brain_config):
    trade_state.save_pending_trade(
        PendingTradeContext(
            trade_id="t-close-1",
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
            confidence_at_entry=0.8,
        )
    )

    resp = bridge_client.post("/trade_result", json=_trade_result_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["recorded"] is True
    assert body["message"] == "ok"

    # Context should be cleaned up after recording.
    assert trade_state.get_pending_trade("t-close-1") is None

    # And ai_brain should now know about this closed trade.
    from ai_brain import dataset_builder

    df = dataset_builder.get_closed_trades_df()
    assert "t-close-1" in df["trade_id"].values
    row = df[df["trade_id"] == "t-close-1"].iloc[0]
    assert row["outcome"] == "win"
    assert row["pnl"] == 25.0
    assert bool(row["bos"]) is True


def test_trade_result_without_pending_context_still_records(bridge_client, tmp_ai_brain_config):
    resp = bridge_client.post("/trade_result", json=_trade_result_payload(trade_id="t-orphan"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["recorded"] is True
    assert "without original candidate context" in body["message"]

    from ai_brain import dataset_builder

    df = dataset_builder.get_closed_trades_df()
    assert "t-orphan" in df["trade_id"].values


def test_trade_result_malformed_returns_422(bridge_client):
    resp = bridge_client.post("/trade_result", json={"trade_id": "t-bad"})
    assert resp.status_code == 422


def test_trade_result_notes_contain_mfe_mae_drawdown(bridge_client, tmp_ai_brain_config):
    bridge_client.post("/trade_result", json=_trade_result_payload(trade_id="t-notes"))

    from ai_brain import dataset_builder
    import json as _json

    df = dataset_builder.get_closed_trades_df()
    row = df[df["trade_id"] == "t-notes"].iloc[0]
    notes = _json.loads(row["notes"])
    assert notes["max_favorable_excursion"] == 30.0
    assert notes["max_adverse_excursion"] == -5.0
    assert notes["drawdown"] == 5.0
    assert notes["exit_reason"] == "tp"
