from datetime import datetime, timedelta, timezone

from ai_brain.feature_engine import build_features, compute_rolling_stats, encode_strategy_tags

from .conftest import make_candidate_trade, make_trade_record


def test_session_day_hour_derivation():
    entry_time = datetime(2026, 1, 6, 14, 30, tzinfo=timezone.utc)  # Tuesday, London/NY overlap
    trade = make_trade_record(entry_time=entry_time)
    features = build_features(trade, history=[])

    assert features.session == "london_ny_overlap"
    assert features.day_of_week == 1  # Tuesday
    assert features.hour_of_day == 14


def test_asian_session_boundary():
    trade = make_trade_record(entry_time=datetime(2026, 1, 6, 3, 0, tzinfo=timezone.utc))
    features = build_features(trade, history=[])
    assert features.session == "asian"


def test_prev5_prev20_rolling_stats_from_hand_built_sequence():
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    history = [
        make_trade_record(
            trade_id=f"h{i}",
            entry_time=base_time + timedelta(hours=i),
            outcome="win" if i % 2 == 0 else "loss",
            pnl=10.0 if i % 2 == 0 else -10.0,
            risk_reward_planned=2.0,
        )
        for i in range(25)
    ]

    prev5 = compute_rolling_stats(history, 5)
    prev20 = compute_rolling_stats(history, 20)

    assert prev5.sample_size == 5
    assert prev20.sample_size == 20
    # last 5 of an alternating win/loss/win/loss/... sequence (even index = win)
    last5_outcomes = [h.outcome for h in history[-5:]]
    expected_win_rate = last5_outcomes.count("win") / 5
    assert prev5.win_rate == expected_win_rate


def test_rolling_stats_empty_history():
    stats = compute_rolling_stats([], 5)
    assert stats.sample_size == 0
    assert stats.win_rate == 0.0


def test_tag_hash_is_order_independent():
    assert encode_strategy_tags(["a", "b"]) == encode_strategy_tags(["b", "a"])
    assert encode_strategy_tags([]) == 0


def test_candidate_trade_features_leave_win_pnl_none():
    candidate = make_candidate_trade()
    features = build_features(candidate, history=[])
    assert features.win is None
    assert features.pnl is None
    assert features.realized_rr is None
    assert features.trade_duration_minutes is None


def test_closed_trade_features_populate_labels():
    trade = make_trade_record(outcome="win", pnl=42.0)
    features = build_features(trade, history=[])
    assert features.win == 1
    assert features.pnl == 42.0
    assert features.realized_rr is not None
    assert features.trade_duration_minutes is not None
