"""XGBoost training and inference.

One classifier (win/loss) plus two regressors (expected RR, expected
profit) share a single feature pipeline and are bundled together as a
``ModelBundle`` so they always travel and version as one unit.

This module never touches the database or the filesystem beyond what's
handed to it — persistence is ``model_manager``'s job, orchestration is
``model_trainer``'s job. It only knows how to fit/predict/evaluate given a
DataFrame that already has the engineered feature + label columns.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, mean_absolute_error, roc_auc_score
from sklearn.preprocessing import LabelEncoder

from ai_brain.config import CONFIG
from ai_brain.feature_engine import CATEGORICAL_COLUMNS, FEATURE_COLUMNS, TradeFeatures, to_feature_dict
from ai_brain.utils import get_logger, utcnow

logger = get_logger(__name__)


@dataclass
class ModelPrediction:
    win_probability: float
    loss_probability: float
    expected_rr: float
    expected_profit: float
    model_confidence: float
    model_version: str


@dataclass
class ModelBundle:
    classifier: object
    rr_regressor: object
    profit_regressor: object
    feature_columns: list[str]
    encoders: dict[str, LabelEncoder]
    version: str
    trained_at: str
    metrics: dict = field(default_factory=dict)


def default_xgb_params() -> dict:
    return dict(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=CONFIG.RANDOM_SEED,
        n_jobs=-1,
    )


def _encode_column(series: pd.Series, encoder: LabelEncoder | None, fit: bool) -> tuple[np.ndarray, LabelEncoder]:
    values = series.astype(str)
    if fit or encoder is None:
        encoder = LabelEncoder()
        codes = encoder.fit_transform(values)
        return codes, encoder

    mapping = {cls: i for i, cls in enumerate(encoder.classes_)}
    unknown_code = len(encoder.classes_)
    codes = values.map(lambda v: mapping.get(v, unknown_code)).to_numpy()
    return codes, encoder


def prepare_matrix(
    df: pd.DataFrame,
    feature_columns: list[str],
    encoders: dict[str, LabelEncoder] | None = None,
    fit_encoders: bool = False,
) -> tuple[pd.DataFrame, dict[str, LabelEncoder]]:
    """Turn engineered feature columns into a numeric matrix for XGBoost.

    Categorical columns are label-encoded; unseen categories at predict
    time (an unseen symbol, a new session bucket) map to a reserved
    "unknown" code instead of raising.
    """
    encoders = dict(encoders) if encoders else {}
    out = pd.DataFrame(index=df.index)

    for col in feature_columns:
        if col in CATEGORICAL_COLUMNS:
            codes, enc = _encode_column(df[col], encoders.get(col), fit=fit_encoders)
            out[col] = codes
            encoders[col] = enc
        else:
            out[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    return out, encoders


def _defensive_filter(df: pd.DataFrame) -> pd.DataFrame:
    """Never train on rows without a known outcome, even though
    dataset_builder already guarantees closed-only, non-null rows —
    belt-and-suspenders per spec."""
    before = len(df)
    df = df.dropna(subset=["win", "pnl", "realized_rr"])
    dropped = before - len(df)
    if dropped:
        logger.warning("xgboost_engine: filtered %d row(s) with missing labels before training.", dropped)
    return df


def fit(df: pd.DataFrame, version: str, params: dict | None = None) -> ModelBundle:
    """Train a fresh ModelBundle on ``df`` (engineered features + labels)."""
    df = _defensive_filter(df)
    if df.empty:
        raise ValueError("No labeled rows available to train on.")

    params = params or default_xgb_params()

    X, encoders = prepare_matrix(df, FEATURE_COLUMNS, fit_encoders=True)
    y_win = df["win"].astype(int)
    y_rr = df["realized_rr"].astype(float)
    y_profit = df["pnl"].astype(float)

    classifier = xgb.XGBClassifier(
        **params, objective="binary:logistic", eval_metric="logloss"
    )
    classifier.fit(X, y_win)

    rr_regressor = xgb.XGBRegressor(**params, objective="reg:squarederror")
    rr_regressor.fit(X, y_rr)

    profit_regressor = xgb.XGBRegressor(**params, objective="reg:squarederror")
    profit_regressor.fit(X, y_profit)

    bundle = ModelBundle(
        classifier=classifier,
        rr_regressor=rr_regressor,
        profit_regressor=profit_regressor,
        feature_columns=FEATURE_COLUMNS,
        encoders=encoders,
        version=version,
        trained_at=utcnow().isoformat(),
        metrics={},
    )
    logger.info("Trained model %s on %d rows.", version, len(df))
    return bundle


def evaluate(bundle: ModelBundle, df: pd.DataFrame) -> dict[str, float]:
    """Evaluate a bundle against a labeled DataFrame (e.g. a held-out split)."""
    df = _defensive_filter(df)
    if df.empty:
        return {"accuracy": float("nan"), "auc": float("nan"), "rr_mae": float("nan"), "profit_mae": float("nan"), "n": 0}

    X, _ = prepare_matrix(df, bundle.feature_columns, encoders=bundle.encoders, fit_encoders=False)
    y_win = df["win"].astype(int)
    y_rr = df["realized_rr"].astype(float)
    y_profit = df["pnl"].astype(float)

    win_pred = bundle.classifier.predict(X)
    win_proba = bundle.classifier.predict_proba(X)[:, 1]
    accuracy = accuracy_score(y_win, win_pred)
    auc = roc_auc_score(y_win, win_proba) if y_win.nunique() > 1 else float("nan")

    rr_mae = mean_absolute_error(y_rr, bundle.rr_regressor.predict(X))
    profit_mae = mean_absolute_error(y_profit, bundle.profit_regressor.predict(X))

    return {
        "accuracy": float(accuracy),
        "auc": float(auc),
        "rr_mae": float(rr_mae),
        "profit_mae": float(profit_mae),
        "n": int(len(df)),
    }


def predict(bundle: ModelBundle, features: TradeFeatures) -> ModelPrediction:
    """Predict win probability / expected RR / expected profit for one
    candidate trade's engineered features."""
    row = to_feature_dict(features)
    row_df = pd.DataFrame([row])

    X, _ = prepare_matrix(row_df, bundle.feature_columns, encoders=bundle.encoders, fit_encoders=False)

    win_probability = float(bundle.classifier.predict_proba(X)[0][1])
    expected_rr = float(bundle.rr_regressor.predict(X)[0])
    expected_profit = float(bundle.profit_regressor.predict(X)[0])
    model_confidence = abs(win_probability - 0.5) * 2

    return ModelPrediction(
        win_probability=win_probability,
        loss_probability=1.0 - win_probability,
        expected_rr=expected_rr,
        expected_profit=expected_profit,
        model_confidence=model_confidence,
        model_version=bundle.version,
    )
