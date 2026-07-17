import pandas as pd

from ai_brain import pattern_engine


def _hand_built_df() -> pd.DataFrame:
    rows = []
    # "london" session: 15/20 wins = 75% win rate
    for i in range(20):
        rows.append({"session": "london", "win": 1 if i < 15 else 0, "pnl": 10.0, "risk_reward_planned": 2.0})
    # "asian" session: 3/20 wins = 15% win rate
    for i in range(20):
        rows.append({"session": "asian", "win": 1 if i < 3 else 0, "pnl": -5.0, "risk_reward_planned": 1.5})
    return pd.DataFrame(rows)


def test_compute_group_stats_known_win_rates():
    df = _hand_built_df()
    stats = pattern_engine.compute_group_stats(df, "session", min_sample=5)
    by_value = {s.group_value: s for s in stats}

    assert by_value["london"].win_rate == 0.75
    assert by_value["london"].sample_size == 20
    assert by_value["asian"].win_rate == 0.15


def test_best_and_worst_respects_min_sample():
    df = _hand_built_df()
    stats = pattern_engine.compute_group_stats(df, "session", min_sample=5)
    best, worst = pattern_engine.best_and_worst(stats, min_sample=25)  # nothing qualifies
    assert best == []
    assert worst == []

    best, worst = pattern_engine.best_and_worst(stats, min_sample=5)
    assert best[0].group_value == "london"
    assert worst[0].group_value == "asian"


def test_generate_pattern_report_surfaces_injected_bias(tmp_config, populated_history):
    report = pattern_engine.generate_pattern_report()
    assert report.sample_size == len(populated_history)
    assert len(report.symbol_stats) > 0
    assert "EURUSD" in report.symbol_stats  # pattern_engine reads raw human-readable trade data


def test_lookup_context_returns_defaults_for_unknown_group(tmp_config, populated_history):
    from ai_brain.feature_engine import TradeFeatures

    report = pattern_engine.generate_pattern_report()
    features = TradeFeatures(
        trade_id="x",
        symbol="totally_unknown_symbol",
        timeframe="M15",
        session="off_hours",
        day_of_week=0,
        hour_of_day=0,
        atr=0.001,
        spread=0.0001,
        volume=100,
        volatility=0.001,
        trend_encoded=0,
        bos=0, choch=0, order_block=0, fair_value_gap=0, liquidity_sweep=0,
        risk_reward_planned=2.0,
        confidence_at_entry=0.5,
        strategy_tag_hash=999999,
        prev_trade_outcome=0,
        prev5_win_rate=0.0, prev5_avg_rr=0.0, prev5_avg_pnl=0.0,
        prev20_win_rate=0.0, prev20_avg_rr=0.0, prev20_avg_pnl=0.0,
        market_regime="unknown",
        trade_duration_minutes=None,
        win=None, pnl=None, realized_rr=None,
    )
    stats = pattern_engine.lookup_context(features, report)
    assert stats.symbol_win_rate == report.overall_win_rate
