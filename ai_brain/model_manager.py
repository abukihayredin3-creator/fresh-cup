"""Versioned model persistence, activation, and rollback.

Every trained ``ModelBundle`` is saved as ``models/model_vN.pkl`` and
never overwritten. ``registry.json`` tracks metadata for every version
and which one is currently active. Rollback simply flips which version is
active — nothing is ever deleted.

Registry writes are rare (only at training completion) and are made
atomic via a temp-file-plus-rename, guarded by an advisory file lock so
two processes (e.g. the trainer and the Telegram bot) can't corrupt it
with a concurrent write.
"""

from __future__ import annotations

import contextlib
import fcntl
import threading
from dataclasses import dataclass

import joblib

from ai_brain.config import CONFIG
from ai_brain.utils import atomic_write_json, ensure_directories, get_logger, read_json

logger = get_logger(__name__)

_REGISTRY_LOCK = threading.RLock()


class ModelManagerError(Exception):
    """Base class for model_manager errors."""


class NoModelAvailableError(ModelManagerError):
    """Raised when a model is requested but none has been trained yet."""


class ModelVersionNotFoundError(ModelManagerError):
    """Raised when a specific model version doesn't exist in the registry."""


class ModelVersionExistsError(ModelManagerError):
    """Raised if something tries to overwrite an existing model version."""


@dataclass
class ModelMetadata:
    version: str
    file: str
    trained_at: str
    trades_used: int
    metrics: dict
    is_active: bool
    trigger_reason: str


@contextlib.contextmanager
def _registry_file_lock():
    ensure_directories()
    CONFIG.REGISTRY_LOCK.touch(exist_ok=True)
    with open(CONFIG.REGISTRY_LOCK, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def _load_registry() -> dict:
    return read_json(CONFIG.REGISTRY_JSON, default={"active_version": None, "models": []})


def _save_registry(registry: dict) -> None:
    atomic_write_json(CONFIG.REGISTRY_JSON, registry)


def next_version() -> str:
    registry = _load_registry()
    existing = [m["version"] for m in registry["models"]]
    numbers = [int(v[1:]) for v in existing if v.startswith("v") and v[1:].isdigit()]
    return f"v{(max(numbers) + 1) if numbers else 1}"


def save_model(
    bundle,
    metrics: dict,
    trigger_reason: str,
    trades_used: int,
    activate: bool = False,
) -> str:
    """Persist ``bundle`` as a new, never-before-used version.

    Returns the assigned version string. Set ``activate=True`` to also
    make it the active model immediately (typically called by
    ``model_trainer`` only after confirming it beats the current best).
    """
    ensure_directories()
    with _REGISTRY_LOCK, _registry_file_lock():
        version = next_version()
        model_path = CONFIG.MODELS_DIR / f"model_{version}.pkl"
        if model_path.exists():
            raise ModelVersionExistsError(f"{model_path} already exists.")

        bundle.version = version
        joblib.dump(bundle, model_path)

        registry = _load_registry()
        registry["models"].append(
            {
                "version": version,
                "file": model_path.name,
                "trained_at": bundle.trained_at,
                "trades_used": trades_used,
                "metrics": metrics,
                "is_active": False,
                "trigger_reason": trigger_reason,
            }
        )
        _save_registry(registry)

        if activate:
            _activate_locked(registry, version)

    logger.info("Saved model %s (active=%s, trigger=%s).", version, activate, trigger_reason)
    return version


def _activate_locked(registry: dict, version: str) -> None:
    found = False
    for m in registry["models"]:
        if m["version"] == version:
            m["is_active"] = True
            found = True
        else:
            m["is_active"] = False
    if not found:
        raise ModelVersionNotFoundError(f"Model version {version} not found in registry.")
    registry["active_version"] = version
    _save_registry(registry)


def set_active(version: str) -> None:
    with _REGISTRY_LOCK, _registry_file_lock():
        registry = _load_registry()
        _activate_locked(registry, version)
    logger.info("Activated model %s.", version)


def get_active_version() -> str | None:
    registry = _load_registry()
    return registry.get("active_version")


def list_versions() -> list[ModelMetadata]:
    registry = _load_registry()
    return [
        ModelMetadata(
            version=m["version"],
            file=m["file"],
            trained_at=m["trained_at"],
            trades_used=m["trades_used"],
            metrics=m["metrics"],
            is_active=m["is_active"],
            trigger_reason=m["trigger_reason"],
        )
        for m in registry["models"]
    ]


def get_metadata(version: str) -> ModelMetadata:
    for m in list_versions():
        if m.version == version:
            return m
    raise ModelVersionNotFoundError(f"Model version {version} not found in registry.")


def load_model(version: str | None = None):
    """Load a ModelBundle. Defaults to the active version.

    Raises ``NoModelAvailableError`` if no model has been trained yet
    (this is the hook that lets everything upstream degrade gracefully
    instead of crashing when the AI Brain is brand new).
    """
    registry = _load_registry()
    if not registry["models"]:
        raise NoModelAvailableError("No models have been trained yet.")

    target_version = version or registry.get("active_version")
    if not target_version:
        raise NoModelAvailableError("No active model is set.")

    entry = next((m for m in registry["models"] if m["version"] == target_version), None)
    if entry is None:
        raise ModelVersionNotFoundError(f"Model version {target_version} not found in registry.")

    model_path = CONFIG.MODELS_DIR / entry["file"]
    if not model_path.exists():
        raise ModelVersionNotFoundError(f"Model file {model_path} is missing on disk.")

    return joblib.load(model_path)


def rollback(to_version: str | None = None) -> str:
    """Roll back to a previous model version.

    If ``to_version`` is omitted, rolls back to the most recently trained
    version that isn't the current active one. Never deletes anything —
    rollback is purely a change of which version is marked active.
    """
    with _REGISTRY_LOCK, _registry_file_lock():
        registry = _load_registry()
        if not registry["models"]:
            raise NoModelAvailableError("No models available to roll back to.")

        if to_version is None:
            current = registry.get("active_version")
            candidates = [m["version"] for m in registry["models"] if m["version"] != current]
            if not candidates:
                raise ModelVersionNotFoundError("No other model version available to roll back to.")
            to_version = candidates[-1]

        _activate_locked(registry, to_version)

    logger.info("Rolled back to model %s.", to_version)
    return to_version
