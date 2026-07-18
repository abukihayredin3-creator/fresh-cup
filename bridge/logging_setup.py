"""Rotating file logger for the bridge, scoped to ``bridge/logs/`` so it
never mixes with ai_brain's own ``logs/`` directory.

Provides ``log_event`` for structured, grep-able logging of the specific
things the bridge must record: every AI request, every response, every
execution, every error, every rejected trade.
"""

from __future__ import annotations

import json
import logging
import threading
from logging.handlers import RotatingFileHandler

from bridge.config import CONFIG

_loggers: dict[str, logging.Logger] = {}
_lock = threading.Lock()

MAX_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 3


def get_logger(name: str) -> logging.Logger:
    """Return a module-scoped logger with a rotating file + stream handler.

    Idempotent: repeated calls with the same name reuse the same logger
    instead of stacking duplicate handlers.
    """
    with _lock:
        if name in _loggers:
            return _loggers[name]

        CONFIG.logs_dir.mkdir(parents=True, exist_ok=True)
        logger = logging.getLogger(name)
        logger.setLevel(CONFIG.log_level)
        logger.propagate = False

        if not logger.handlers:
            fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")

            file_handler = RotatingFileHandler(
                CONFIG.logs_dir / "bridge.log", maxBytes=MAX_BYTES, backupCount=BACKUP_COUNT
            )
            file_handler.setFormatter(fmt)
            logger.addHandler(file_handler)

            stream_handler = logging.StreamHandler()
            stream_handler.setFormatter(fmt)
            logger.addHandler(stream_handler)

        _loggers[name] = logger
        return logger


def log_event(logger: logging.Logger, event: str, level: int = logging.INFO, **fields) -> None:
    """Structured log line: ``EVENT_TYPE {json fields}``.

    ``event`` is one of REQUEST / RESPONSE / EXECUTION / ERROR / REJECTED
    (or similar) so log lines are grep-able by category, e.g.
    ``grep 'REJECTED ' bridge/logs/bridge.log``.
    """
    logger.log(level, "%s %s", event, json.dumps(fields, default=str))
