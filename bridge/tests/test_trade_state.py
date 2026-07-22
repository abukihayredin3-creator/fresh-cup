from bridge import trade_state
from bridge.trade_state import PendingTradeContext


def _context(**overrides) -> PendingTradeContext:
    defaults = dict(
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
        strategy_tags=["smc_reversal", "breakout"],
        risk_reward_planned=2.0,
        confidence_at_entry=0.72,
    )
    defaults.update(overrides)
    return PendingTradeContext(**defaults)


def test_get_unknown_trade_returns_none(tmp_bridge_config):
    assert trade_state.get_pending_trade("does-not-exist") is None


def test_save_and_get_round_trip(tmp_bridge_config):
    trade_state.save_pending_trade(_context())
    result = trade_state.get_pending_trade("t-1")

    assert result is not None
    assert result.symbol == "EURUSD"
    assert result.bos is True
    assert result.choch is False
    assert result.strategy_tags == ["smc_reversal", "breakout"]
    assert result.risk_reward_planned == 2.0
    assert result.confidence_at_entry == 0.72


def test_save_allows_null_confidence(tmp_bridge_config):
    trade_state.save_pending_trade(_context(trade_id="t-2", confidence_at_entry=None))
    result = trade_state.get_pending_trade("t-2")
    assert result.confidence_at_entry is None


def test_re_saving_same_trade_id_overwrites(tmp_bridge_config):
    trade_state.save_pending_trade(_context(trade_id="t-3", trend="up"))
    trade_state.save_pending_trade(_context(trade_id="t-3", trend="down"))
    result = trade_state.get_pending_trade("t-3")
    assert result.trend == "down"


def test_delete_removes_context(tmp_bridge_config):
    trade_state.save_pending_trade(_context(trade_id="t-4"))
    assert trade_state.get_pending_trade("t-4") is not None

    trade_state.delete_pending_trade("t-4")
    assert trade_state.get_pending_trade("t-4") is None


def test_delete_unknown_trade_is_a_no_op(tmp_bridge_config):
    trade_state.delete_pending_trade("never-existed")  # should not raise
