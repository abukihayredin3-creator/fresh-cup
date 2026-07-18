"""Bridge configuration loader.

Loads ``config/bridge_config.yaml`` and ``config/news_blackout.yaml``.
Paths are relative to a configurable base directory (env
``BRIDGE_BASE_DIR``, default: the repo root) so tests can point at an
isolated tmp directory — the same pattern ``ai_brain/config.py`` uses for
its own isolation.

Nothing here imports ``ai_brain`` — this module only knows about the
bridge's own execution-rule thresholds and file locations.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml

DEFAULT_SESSIONS = ["asian", "london", "london_ny_overlap", "ny", "off_hours"]


@dataclass
class BlackoutWindow:
    symbol: str
    start_utc: datetime
    end_utc: datetime
    reason: str = ""

    def contains(self, symbol: str, when: datetime) -> bool:
        if self.symbol.upper() != symbol.upper():
            return False
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return self.start_utc <= when <= self.end_utc


@dataclass
class TradingHours:
    start: str = "00:00"
    end: str = "23:59"


@dataclass
class BridgeConfig:
    base_dir: Path
    config_dir: Path
    logs_dir: Path
    data_dir: Path

    host: str = "127.0.0.1"
    port: int = 8000

    max_risk_percent: float = 2.0
    default_lot: float = 0.01
    min_lot: float = 0.01
    max_lot: float = 1.0
    sl_atr_multiplier: float = 1.5
    default_rr: float = 2.0

    confidence_threshold: float = 0.6
    max_open_positions: int = 3
    max_spread_points: dict = field(default_factory=lambda: {"default": 25})
    allowed_symbols: list = field(default_factory=list)
    allowed_sessions: list = field(default_factory=lambda: list(DEFAULT_SESSIONS))
    trading_hours: TradingHours = field(default_factory=TradingHours)

    news_filter_enabled: bool = True
    blackout_windows: list = field(default_factory=list)

    log_level: str = "INFO"

    # Shared-secret header required on /predict and /trade_result when
    # non-empty (checked via constant-time comparison in bridge/app.py).
    # Empty by default so existing localhost-only setups keep working
    # unchanged — but that means an empty key on a non-loopback host is
    # a real exposure; bridge/app.py logs a startup warning for exactly
    # that combination.
    api_key: str = ""

    LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "::1")

    def is_bound_to_loopback(self) -> bool:
        return self.host in self.LOOPBACK_HOSTS

    @classmethod
    def from_files(cls, base_dir: Path | str | None = None) -> "BridgeConfig":
        base = Path(base_dir) if base_dir is not None else Path(
            os.environ.get("BRIDGE_BASE_DIR", Path(__file__).resolve().parent.parent)
        )
        config_dir = base / "config"
        logs_dir = base / "bridge" / "logs"
        data_dir = base / "bridge" / "data"

        bridge_yaml = _load_yaml(config_dir / "bridge_config.yaml")
        news_yaml = _load_yaml(config_dir / "news_blackout.yaml")

        server = bridge_yaml.get("server", {}) or {}
        risk = bridge_yaml.get("risk", {}) or {}
        execution = bridge_yaml.get("execution", {}) or {}
        news_filter = bridge_yaml.get("news_filter", {}) or {}
        security = bridge_yaml.get("security", {}) or {}
        trading_hours_raw = execution.get("trading_hours", {}) or {}
        trading_hours_start = trading_hours_raw.get("start", "00:00")
        trading_hours_end = trading_hours_raw.get("end", "23:59")
        _validate_hhmm(trading_hours_start, "execution.trading_hours.start")
        _validate_hhmm(trading_hours_end, "execution.trading_hours.end")

        trading_hours = TradingHours(start=trading_hours_start, end=trading_hours_end)

        blackout_windows = [
            BlackoutWindow(
                symbol=w["symbol"],
                start_utc=_parse_dt(w["start_utc"]),
                end_utc=_parse_dt(w["end_utc"]),
                reason=w.get("reason", ""),
            )
            for w in (news_yaml.get("blackout_windows") or [])
        ]

        return cls(
            base_dir=base,
            config_dir=config_dir,
            logs_dir=logs_dir,
            data_dir=data_dir,
            host=server.get("host", "127.0.0.1"),
            port=int(server.get("port", 8000)),
            max_risk_percent=float(risk.get("max_risk_percent", 2.0)),
            default_lot=float(risk.get("default_lot", 0.01)),
            min_lot=float(risk.get("min_lot", 0.01)),
            max_lot=float(risk.get("max_lot", 1.0)),
            sl_atr_multiplier=float(risk.get("sl_atr_multiplier", 1.5)),
            default_rr=float(risk.get("default_rr", 2.0)),
            confidence_threshold=float(execution.get("confidence_threshold", 0.6)),
            max_open_positions=int(execution.get("max_open_positions", 3)),
            max_spread_points=execution.get("max_spread_points") or {"default": 25},
            allowed_symbols=execution.get("allowed_symbols") or [],
            allowed_sessions=execution.get("allowed_sessions") or list(DEFAULT_SESSIONS),
            trading_hours=trading_hours,
            news_filter_enabled=bool(news_filter.get("enabled", True)),
            blackout_windows=blackout_windows,
            log_level=bridge_yaml.get("log_level", "INFO"),
            api_key=str(security.get("api_key", "") or ""),
        )

    def max_spread_for(self, symbol: str) -> float:
        return float(
            self.max_spread_points.get(symbol.upper(), self.max_spread_points.get("default", 25))
        )

    def is_symbol_allowed(self, symbol: str) -> bool:
        # An empty allow-list means "no restriction configured" rather
        # than "reject everything" — bridge_config.yaml ships with an
        # explicit list, so this only matters if that file is missing.
        if not self.allowed_symbols:
            return True
        return symbol.upper() in {s.upper() for s in self.allowed_symbols}

    def is_session_allowed(self, session: str) -> bool:
        return session in self.allowed_sessions

    def is_within_trading_hours(self, when: datetime) -> bool:
        start_h, start_m = (int(p) for p in self.trading_hours.start.split(":"))
        end_h, end_m = (int(p) for p in self.trading_hours.end.split(":"))
        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        now_minutes = when.hour * 60 + when.minute

        if start_minutes <= end_minutes:
            return start_minutes <= now_minutes <= end_minutes
        # Window wraps past midnight (e.g. 22:00 -> 06:00).
        return now_minutes >= start_minutes or now_minutes <= end_minutes

    def active_blackout(self, symbol: str, when: datetime) -> BlackoutWindow | None:
        if not self.news_filter_enabled:
            return None
        for window in self.blackout_windows:
            if window.contains(symbol, when):
                return window
        return None


def _validate_hhmm(value: str, field_name: str) -> None:
    """Fail fast at config-load time (process startup) rather than on
    every subsequent /predict request — a malformed trading_hours value
    would otherwise break 100% of traffic continuously instead of once,
    loudly, at boot.
    """
    parts = value.split(":")
    if len(parts) != 2:
        raise ValueError(f"{field_name} must be 'HH:MM', got {value!r}")
    try:
        hour, minute = int(parts[0]), int(parts[1])
    except ValueError:
        raise ValueError(f"{field_name} must be 'HH:MM' with integer parts, got {value!r}") from None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"{field_name} must be a valid 24h time, got {value!r}")


def _load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path) as f:
        return yaml.safe_load(f) or {}


def _parse_dt(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


CONFIG = BridgeConfig.from_files()
