import numpy as np
import pandas as pd
import pytest

from ai_brain import xgboost_engine
from ai_brain.feature_engine import FEATURE_COLUMNS


def _learnable_df(n=200, seed=0) -> pd.DataFrame:
    """A synthetic dataframe with a genuinely learnable relationship:
    win = 1 whenever bos == 1 and order_block == 1 (plus noise)."""
    rng = np.random.RandomState(seed)
    rows = []
    for i in range(n):
        row = {col: 0 for col in FEATURE_COLUMNS}
        row["symbol"] = rng.choice(["EURUSD", "GBPUSD"])
        row["timeframe"] = rng.choice(["H1", "H4"])
        row["session"] = rng.choice(["london", "ny"])
        row["market_regime"] = rng.choice(["trending", "ranging"])
        row["day_of_week"] = int(rng.randint(0, 5))
        row["hour_of_day"] = int(rng.randint(0, 24))
        row["atr"] = float(rng.uniform(0.001, 0.01))
        row["spread"] = float(rng.uniform(0.0001, 0.001))
        row["volume"] = float(rng.uniform(100, 5000))
        row["volatility"] = float(rng.uniform(0.001, 0.01))
        row["trend_encoded"] = int(rng.choice([-1, 0, 1]))
        bos = int(rng.choice([0, 1]))
        order_block = int(rng.choice([0, 1]))
        row["bos"] = bos
        row["choch"] = int(rng.choice([0, 1]))
        row["order_block"] = order_block
        row["fair_value_gap"] = int(rng.choice([0, 1]))
        row["liquidity_sweep"] = int(rng.choice([0, 1]))
        row["risk_reward_planned"] = float(rng.uniform(1.0, 3.0))
        row["confidence_at_entry"] = float(rng.uniform(0.3, 0.9))
        row["strategy_tag_hash"] = int(rng.randint(0, 1000))
        row["prev_trade_outcome"] = int(rng.choice([-1, 0, 1]))
        row["prev5_win_rate"] = float(rng.uniform(0, 1))
        row["prev5_avg_rr"] = float(rng.uniform(1, 3))
        row["prev5_avg_pnl"] = float(rng.uniform(-50, 50))
        row["prev20_win_rate"] = float(rng.uniform(0, 1))
        row["prev20_avg_rr"] = float(rng.uniform(1, 3))
        row["prev20_avg_pnl"] = float(rng.uniform(-50, 50))
        row["trade_duration_minutes"] = float(rng.uniform(15, 500))

        win_prob = 0.85 if (bos and order_block) else 0.15
        win = 1 if rng.random() < win_prob else 0
        row["win"] = win
        row["pnl"] = 50.0 if win else -50.0
        row["realized_rr"] = row["risk_reward_planned"] if win else -1.0
        rows.append(row)
    return pd.DataFrame(rows)


def test_fit_predict_round_trip_learns_real_signal():
    df = _learnable_df(n=300)
    bundle = xgboost_engine.fit(df, version="v_test")

    metrics = xgboost_engine.evaluate(bundle, df)
    assert metrics["accuracy"] > 0.8  # should easily learn bos & order_block => win

    row = df.iloc[0]
    from ai_brain.feature_engine import TradeFeatures

    features = TradeFeatures(
        trade_id="t1",
        **{col: row[col] for col in FEATURE_COLUMNS},
        win=None, pnl=None, realized_rr=None,
    )
    prediction = xgboost_engine.predict(bundle, features)
    assert 0.0 <= prediction.win_probability <= 1.0
    assert 0.0 <= prediction.loss_probability <= 1.0
    assert abs(prediction.win_probability + prediction.loss_probability - 1.0) < 1e-6


def test_fit_defensively_filters_null_labels():
    df = _learnable_df(n=50)
    df.loc[0:4, "win"] = np.nan
    bundle = xgboost_engine.fit(df, version="v_filter")
    # Should not raise, and should have trained on fewer than 50 rows.
    assert bundle.version == "v_filter"


def test_fit_raises_on_all_null_labels():
    df = _learnable_df(n=10)
    df["win"] = np.nan
    with pytest.raises(ValueError):
        xgboost_engine.fit(df, version="v_empty")


def test_evaluate_returns_expected_metric_keys():
    df = _learnable_df(n=100)
    bundle = xgboost_engine.fit(df, version="v_eval")
    metrics = xgboost_engine.evaluate(bundle, df)
    assert set(["accuracy", "auc", "rr_mae", "profit_mae", "n"]).issubset(metrics.keys())


def test_unseen_category_at_predict_time_does_not_raise():
    df = _learnable_df(n=100)
    bundle = xgboost_engine.fit(df, version="v_unseen")

    from ai_brain.feature_engine import TradeFeatures

    row = df.iloc[0].to_dict()
    row["symbol"] = "BRAND_NEW_SYMBOL"
    features = TradeFeatures(
        trade_id="t_unseen",
        **{col: row[col] for col in FEATURE_COLUMNS},
        win=None, pnl=None, realized_rr=None,
    )
    prediction = xgboost_engine.predict(bundle, features)
    assert 0.0 <= prediction.win_probability <= 1.0
