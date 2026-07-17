import ai_brain
from ai_brain import model_trainer
from ai_brain.config import CONFIG

from .conftest import generate_synthetic_trades, make_candidate_trade


def test_is_enabled_reflects_config(tmp_config):
    assert ai_brain.is_enabled() is True
    ai_brain.disable()
    assert ai_brain.is_enabled() is False
    ai_brain.enable()
    assert ai_brain.is_enabled() is True


def test_record_trade_and_get_prediction_do_not_raise_on_fresh_repo(tmp_config):
    trade = generate_synthetic_trades(1)[0]
    ai_brain.record_trade(trade)  # should not raise even with zero prior history

    candidate = make_candidate_trade()
    decision = ai_brain.get_prediction(candidate)
    assert decision.recommendation in ("favorable", "unfavorable", "neutral")


def test_disabled_ai_short_circuits_before_touching_decision_engine(tmp_config, monkeypatch):
    ai_brain.disable()

    called = {"evaluate": False}

    def spy(*args, **kwargs):
        called["evaluate"] = True
        raise AssertionError("evaluate_trade should not be called while disabled")

    monkeypatch.setattr(ai_brain, "evaluate_trade", spy)

    decision = ai_brain.get_prediction(make_candidate_trade())
    assert called["evaluate"] is False
    assert decision.data_sufficient is False
    assert decision.recommendation == "neutral"

    ai_brain.record_trade(generate_synthetic_trades(1)[0])
    # dataset_builder should not have been touched either; verify no closed
    # trades were recorded while disabled.
    from ai_brain import dataset_builder

    assert dataset_builder.get_closed_trades_df().empty

    ai_brain.enable()


def test_full_round_trip_triggers_automatic_retrain(tmp_config):
    CONFIG.MIN_TRADES_TO_TRAIN = 50
    CONFIG.RETRAIN_EVERY_N_TRADES = 100

    trades = generate_synthetic_trades(150)
    for trade in trades:
        ai_brain.record_trade(trade)

    state = model_trainer.get_trainer_state()
    # Either the count trigger already fired at 100 trades (leaving <50
    # trades since the reset) or a model now exists.
    assert state.trades_since_last_train < 150

    from ai_brain import model_manager

    assert model_manager.get_active_version() is not None

    candidate = make_candidate_trade(symbol="EURUSD")
    decision = ai_brain.get_prediction(candidate)
    assert decision.data_sufficient is True


def test_get_prediction_never_raises_even_on_internal_error(tmp_config, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("simulated internal failure")

    monkeypatch.setattr(ai_brain, "evaluate_trade", boom)
    decision = ai_brain.get_prediction(make_candidate_trade())
    assert decision.data_sufficient is False
    assert decision.recommendation == "neutral"
