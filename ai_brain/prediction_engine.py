"""Loads the active model and scores candidate trades.

Every prediction is logged to ``predictions_log`` — the single
bookkeeping site ``learning_manager`` later reconciles against actual
outcomes to compute real-world prediction accuracy.

``NoModelAvailableError`` is intentionally allowed to propagate out of
this module rather than being swallowed here: the "not enough data yet,
degrade gracefully" policy belongs to the single boundary in
``ai_decision_engine`` / ``__init__.py``, not scattered across every
internal caller.
"""

from __future__ import annotations

from ai_brain import model_manager, xgboost_engine
from ai_brain.feature_engine import TradeFeatures
from ai_brain.utils import db_cursor, get_logger, to_iso, utcnow

logger = get_logger(__name__)


def predict(features: TradeFeatures) -> xgboost_engine.ModelPrediction:
    """Score one candidate trade's engineered features with the active model."""
    bundle = model_manager.load_model()
    prediction = xgboost_engine.predict(bundle, features)
    _log_prediction(features.trade_id, prediction)
    return prediction


def predict_batch(features_list: list[TradeFeatures]) -> list[xgboost_engine.ModelPrediction]:
    bundle = model_manager.load_model()
    predictions = []
    for features in features_list:
        prediction = xgboost_engine.predict(bundle, features)
        _log_prediction(features.trade_id, prediction)
        predictions.append(prediction)
    return predictions


def _log_prediction(trade_id: str, prediction: xgboost_engine.ModelPrediction) -> None:
    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO predictions_log
              (trade_id, predicted_at, model_version, win_probability, expected_rr, expected_profit, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                trade_id,
                to_iso(utcnow()),
                prediction.model_version,
                prediction.win_probability,
                prediction.expected_rr,
                prediction.expected_profit,
                prediction.model_confidence,
            ),
        )
