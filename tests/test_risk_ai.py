from ai_brain.risk_ai import AccountRiskSettings, recommend


def test_recommended_lot_size_never_exceeds_bot_provided():
    settings = AccountRiskSettings(
        account_balance=10_000,
        max_risk_percent=5.0,
        max_drawdown_percent=20.0,
        bot_provided_lot_size=0.05,
        stop_loss_distance_points=100,
        point_value=10,
    )
    for confidence in (0.0, 0.3, 0.5, 0.8, 1.0):
        for quality in (0.0, 0.5, 1.0):
            rec = recommend(quality, confidence, settings, planned_rr=2.0, win_probability=0.9)
            if rec.recommended_lot_size is not None:
                assert rec.recommended_lot_size <= settings.bot_provided_lot_size + 1e-9


def test_risk_percent_never_exceeds_configured_max():
    settings = AccountRiskSettings(account_balance=10_000, max_risk_percent=1.5, max_drawdown_percent=10.0)
    rec = recommend(1.0, 1.0, settings, planned_rr=2.0)
    assert rec.recommended_risk_percent <= 1.5


def test_drawdown_reduces_recommended_risk():
    base_settings = AccountRiskSettings(account_balance=10_000, max_risk_percent=5.0, max_drawdown_percent=20.0, current_drawdown_percent=0.0)
    drawdown_settings = AccountRiskSettings(account_balance=10_000, max_risk_percent=5.0, max_drawdown_percent=20.0, current_drawdown_percent=15.0)

    rec_base = recommend(1.0, 1.0, base_settings, planned_rr=2.0)
    rec_drawdown = recommend(1.0, 1.0, drawdown_settings, planned_rr=2.0)
    assert rec_drawdown.recommended_risk_percent < rec_base.recommended_risk_percent


def test_no_lot_size_inputs_yields_none_lot_size():
    settings = AccountRiskSettings(account_balance=10_000, max_risk_percent=2.0, max_drawdown_percent=10.0)
    rec = recommend(0.7, 0.7, settings, planned_rr=2.0)
    assert rec.recommended_lot_size is None


def test_recommended_rr_floors_at_breakeven():
    settings = AccountRiskSettings(account_balance=10_000, max_risk_percent=2.0, max_drawdown_percent=10.0)
    # win_probability=0.2 => breakeven RR = 0.8/0.2 = 4.0, higher than planned_rr=1.0
    rec = recommend(0.5, 0.5, settings, planned_rr=1.0, win_probability=0.2)
    assert rec.recommended_rr == 4.0
