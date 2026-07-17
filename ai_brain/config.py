"""Central configuration for the MMXM AI Brain.

All paths, thresholds, and feature flags live here so the rest of the
package never hardcodes a path or a magic number. Values are read from
environment variables with sane defaults, so the AI Brain runs out of the
box with zero configuration.
"""

from __future__ import annotations

import os
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw not in (None, "") else default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw not in (None, "") else default


class AIBrainConfig:
    """Runtime configuration for the AI Brain.

    Construct via ``AIBrainConfig.from_env()``. Tests may build one
    directly and point ``base_dir`` at a temp directory to fully isolate
    filesystem/DB state.
    """

    def __init__(self, base_dir: Path | str | None = None) -> None:
        self.base_dir = Path(base_dir) if base_dir is not None else Path(
            os.environ.get("AI_BRAIN_BASE_DIR", Path(__file__).resolve().parent.parent)
        )

        # --- feature flag -----------------------------------------------
        self.AI_BRAIN_ENABLED = _env_bool("AI_BRAIN_ENABLED", True)

        # --- paths --------------------------------------------------------
        self.DATA_DIR = self.base_dir / "data"
        self.MODELS_DIR = self.base_dir / "models"
        self.LOGS_DIR = self.base_dir / "logs"
        self.SNAPSHOTS_DIR = self.DATA_DIR / "snapshots"
        self.TRAINING_DATASET_CSV = self.DATA_DIR / "training_dataset.csv"
        self.TRADE_HISTORY_DB = self.DATA_DIR / "trade_history.db"
        self.REGISTRY_JSON = self.MODELS_DIR / "registry.json"
        self.REGISTRY_LOCK = self.MODELS_DIR / ".registry.lock"

        # --- training / retraining -----------------------------------------
        self.RETRAIN_EVERY_N_TRADES = _env_int("AI_BRAIN_RETRAIN_EVERY_N_TRADES", 100)
        self.RETRAIN_WEEKLY = _env_bool("AI_BRAIN_RETRAIN_WEEKLY", True)
        self.RETRAIN_WEEKLY_DAYS = _env_int("AI_BRAIN_RETRAIN_WEEKLY_DAYS", 7)
        self.MIN_TRADES_TO_TRAIN = _env_int("AI_BRAIN_MIN_TRADES_TO_TRAIN", 50)
        self.TRAIN_TEST_SPLIT = _env_float("AI_BRAIN_TRAIN_TEST_SPLIT", 0.2)
        self.WALK_FORWARD_FOLDS = _env_int("AI_BRAIN_WALK_FORWARD_FOLDS", 5)
        self.RANDOM_SEED = _env_int("AI_BRAIN_RANDOM_SEED", 42)

        # --- risk -----------------------------------------------------------
        self.MAX_RISK_PERCENT = _env_float("AI_BRAIN_MAX_RISK_PERCENT", 2.0)
        self.DEFAULT_RISK_PERCENT = _env_float("AI_BRAIN_DEFAULT_RISK_PERCENT", 1.0)
        self.MIN_RISK_PERCENT = _env_float("AI_BRAIN_MIN_RISK_PERCENT", 0.25)

        # --- confidence -------------------------------------------------------
        self.MIN_SAMPLE_SIZE_FOR_CONFIDENCE = _env_int(
            "AI_BRAIN_MIN_SAMPLE_SIZE_FOR_CONFIDENCE", 20
        )
        self.CONFIDENCE_MODEL_WEIGHT = _env_float("AI_BRAIN_CONFIDENCE_MODEL_WEIGHT", 0.6)
        self.CONFIDENCE_HISTORY_WEIGHT = _env_float("AI_BRAIN_CONFIDENCE_HISTORY_WEIGHT", 0.4)

        # --- pattern engine ----------------------------------------------------
        self.PATTERN_MIN_SAMPLE_SIZE = _env_int("AI_BRAIN_PATTERN_MIN_SAMPLE_SIZE", 10)
        self.PATTERN_HIGH_RISK_WIN_RATE_DELTA = _env_float(
            "AI_BRAIN_PATTERN_HIGH_RISK_WIN_RATE_DELTA", 0.15
        )

        # --- trade quality thresholds -----------------------------------------
        self.QUALITY_FAVORABLE_CONFIDENCE = _env_float(
            "AI_BRAIN_QUALITY_FAVORABLE_CONFIDENCE", 0.6
        )
        self.QUALITY_UNFAVORABLE_CONFIDENCE = _env_float(
            "AI_BRAIN_QUALITY_UNFAVORABLE_CONFIDENCE", 0.4
        )

        # --- explainability -----------------------------------------------------
        self.USE_SHAP = _env_bool("AI_BRAIN_USE_SHAP", False)
        self.EXPLAIN_TOP_N_FEATURES = _env_int("AI_BRAIN_EXPLAIN_TOP_N_FEATURES", 5)

        # --- telegram ------------------------------------------------------------
        self.TELEGRAM_BOT_TOKEN = os.environ.get("AI_BRAIN_TELEGRAM_BOT_TOKEN", "")
        allowed = os.environ.get("AI_BRAIN_TELEGRAM_ALLOWED_CHAT_IDS", "")
        self.TELEGRAM_ALLOWED_CHAT_IDS = [
            int(c) for c in allowed.split(",") if c.strip().isdigit()
        ]

        # --- logging ----------------------------------------------------------
        self.LOG_LEVEL = os.environ.get("AI_BRAIN_LOG_LEVEL", "INFO")
        self.LOG_FILE = self.LOGS_DIR / "ai_brain.log"
        self.LOG_MAX_BYTES = _env_int("AI_BRAIN_LOG_MAX_BYTES", 5 * 1024 * 1024)
        self.LOG_BACKUP_COUNT = _env_int("AI_BRAIN_LOG_BACKUP_COUNT", 3)

    @classmethod
    def from_env(cls) -> "AIBrainConfig":
        return cls()


CONFIG = AIBrainConfig.from_env()
