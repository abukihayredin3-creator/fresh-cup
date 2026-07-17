from ai_brain import ai_decision_engine, model_trainer
from ai_brain.risk_ai import AccountRiskSettings

from .conftest import make_candidate_trade


def test_zero_model_returns_graceful_neutral_decision(tmp_config):
    candidate = make_candidate_trade()
    decision = ai_decision_engine.evaluate_trade(candidate)

    assert decision.data_sufficient is False
    assert decision.recommendation == "neutral"
    assert decision.trade_quality == "insufficient_data"
    assert decision.model_prediction is None
    assert len(decision.warnings) > 0


def test_full_decision_with_trained_model(tmp_config, populated_history):
    model_trainer.retrain(trigger_reason="test")

    candidate = make_candidate_trade(symbol="EURUSD")
    decision = ai_decision_engine.evaluate_trade(candidate)

    assert decision.data_sufficient is True
    assert decision.model_prediction is not None
    assert decision.recommendation in ("favorable", "unfavorable", "neutral")
    assert 0.0 <= decision.final_confidence <= 1.0
    assert decision.explanation.summary
    assert decision.explanation.probability_breakdown.get("win_probability") is not None


def test_risk_recommendation_never_exceeds_bot_provided_lot_size(tmp_config, populated_history):
    model_trainer.retrain(trigger_reason="test")
    candidate = make_candidate_trade(symbol="EURUSD")

    for lot in (0.01, 0.1, 1.0):
        settings = AccountRiskSettings(
            account_balance=5000,
            max_risk_percent=5.0,
            max_drawdown_percent=20.0,
            bot_provided_lot_size=lot,
            stop_loss_distance_points=50,
            point_value=10,
        )
        decision = ai_decision_engine.evaluate_trade(candidate, account_risk=settings)
        if decision.risk_recommendation.recommended_lot_size is not None:
            assert decision.risk_recommendation.recommended_lot_size <= lot + 1e-9


def test_decision_never_recommends_buy_or_sell(tmp_config):
    """The recommendation label is strictly advisory, never an execution signal."""
    candidate = make_candidate_trade()
    decision = ai_decision_engine.evaluate_trade(candidate)
    assert decision.recommendation not in ("buy", "sell")
