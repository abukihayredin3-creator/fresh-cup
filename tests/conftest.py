from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from ai_brain.config import AIBrainConfig
from ai_brain.feature_engine import CandidateTrade, TradeRecord


@pytest.fixture
def tmp_config(tmp_path, monkeypatch):
    """Point every AI Brain path at an isolated tmp directory for this test."""
    from ai_brain.config import CONFIG
    from ai_brain.utils import ensure_directories

    fresh = AIBrainConfig(base_dir=tmp_path)
    for key, value in vars(fresh).items():
        setattr(CONFIG, key, value)
    ensure_directories()

    # Re-enable in case a previous test disabled the AI Brain.
    CONFIG.AI_BRAIN_ENABLED = True
    yield CONFIG


def make_trade_record(**overrides) -> TradeRecord:
    now = overrides.pop("entry_time", datetime(2026, 1, 6, 14, 0, tzinfo=timezone.utc))  # a Tuesday, NY/London overlap
    duration = overrides.pop("duration_minutes", 60)
    defaults = dict(
        trade_id=str(uuid.uuid4()),
        symbol="EURUSD",
        timeframe="H1",
        direction="buy",
        entry_time=now,
        exit_time=now + timedelta(minutes=duration),
        entry_price=1.1000,
        exit_price=1.1050,
        stop_loss=1.0950,
        take_profit=1.1100,
        lot_size=0.1,
        atr=0.0015,
        spread=0.0002,
        volume=1000.0,
        trend="up",
        bos=True,
        choch=False,
        order_block=True,
        fair_value_gap=False,
        liquidity_sweep=False,
        strategy_tags=["smc_reversal"],
        risk_reward_planned=2.0,
        confidence_at_entry=0.7,
        pnl=50.0,
        outcome="win",
        is_closed=True,
        notes="",
    )
    defaults.update(overrides)
    return TradeRecord(**defaults)


def make_candidate_trade(**overrides) -> CandidateTrade:
    now = overrides.pop("entry_time", datetime(2026, 1, 6, 14, 0, tzinfo=timezone.utc))
    defaults = dict(
        trade_id=str(uuid.uuid4()),
        symbol="EURUSD",
        timeframe="H1",
        direction="buy",
        entry_time=now,
        entry_price=1.1000,
        stop_loss=1.0950,
        take_profit=1.1100,
        atr=0.0015,
        spread=0.0002,
        volume=1000.0,
        trend="up",
        bos=True,
        choch=False,
        order_block=True,
        fair_value_gap=False,
        liquidity_sweep=False,
        strategy_tags=["smc_reversal"],
        risk_reward_planned=2.0,
        confidence_at_entry=0.7,
    )
    defaults.update(overrides)
    return CandidateTrade(**defaults)


def generate_synthetic_trades(count: int, seed: int = 42) -> list[TradeRecord]:
    """Small self-contained synthetic trade generator for tests (mirrors
    scripts/generate_sample_trades.py at reduced complexity, kept local to
    avoid cross-directory import fragility in the test suite)."""
    rng = random.Random(seed)
    symbols = ["EURUSD", "GBPUSD", "XAUUSD"]
    now = datetime.now(timezone.utc)
    trades = []

    for i in range(count):
        symbol = rng.choice(symbols)
        entry_time = now - timedelta(days=90) + timedelta(hours=i * 3)
        entry_price = round(rng.uniform(1.0, 1.5), 5)
        atr = round(entry_price * 0.005, 5)
        rr = round(rng.uniform(1.0, 3.0), 2)

        # EURUSD in the london/ny overlap hours wins more often, giving
        # pattern/model tests a genuine, non-random signal to find.
        base = 0.4
        if symbol == "EURUSD":
            base += 0.15
        if 13 <= entry_time.hour < 16:
            base += 0.15
        win = rng.random() < max(0.05, min(0.95, base))

        pnl = round(rng.uniform(20, 100), 2) if win else -round(rng.uniform(20, 100), 2)
        trades.append(
            make_trade_record(
                trade_id=str(uuid.uuid4()),
                symbol=symbol,
                entry_time=entry_time,
                duration_minutes=60,
                entry_price=entry_price,
                exit_price=entry_price + (atr if win else -atr),
                stop_loss=entry_price - atr,
                take_profit=entry_price + atr * rr,
                atr=atr,
                risk_reward_planned=rr,
                pnl=pnl,
                outcome="win" if win else "loss",
                bos=rng.random() < 0.5,
                choch=rng.random() < 0.3,
                order_block=rng.random() < 0.4,
                fair_value_gap=rng.random() < 0.35,
                liquidity_sweep=rng.random() < 0.3,
            )
        )
    trades.sort(key=lambda t: t.entry_time)
    return trades


@pytest.fixture
def populated_history(tmp_config):
    """Records 200 synthetic closed trades through the real dataset_builder
    path and returns them, for tests that need a trained model or a
    populated pattern report."""
    from ai_brain import dataset_builder

    trades = generate_synthetic_trades(200)
    for trade in trades:
        dataset_builder.append_closed_trade(trade)
    return trades
