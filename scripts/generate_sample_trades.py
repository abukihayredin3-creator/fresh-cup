#!/usr/bin/env python3
"""Generate synthetic closed trades to exercise the AI Brain end-to-end.

There is no live MT5 feed in this environment, so this script invents a
few hundred plausible closed trades — varied symbols, sessions, SMC
signals, and outcomes with a genuinely learnable (not random) pattern —
and feeds them through the *real* public contract, ``ai_brain.record_trade``,
exactly as a live trading bot eventually would. This lets the dataset
builder, XGBoost trainer, pattern engine, explainability, and dashboard
all be demonstrated without a real market connection.

Usage:
    python scripts/generate_sample_trades.py [--count 300] [--seed 42]
"""

from __future__ import annotations

import argparse
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ai_brain  # noqa: E402
from ai_brain import TradeRecord  # noqa: E402

SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY", "GBPJPY", "AUDUSD"]
TIMEFRAMES = ["M15", "H1", "H4"]
STRATEGY_TAG_POOL = [
    "smc_reversal",
    "trend_continuation",
    "liquidity_grab",
    "breakout",
    "range_fade",
]

# Baseline win probability by symbol, so pattern_engine has real
# "best/worst symbol" signal to discover rather than pure noise.
_SYMBOL_EDGE = {
    "EURUSD": 0.05,
    "GBPUSD": 0.0,
    "XAUUSD": -0.05,
    "USDJPY": 0.03,
    "GBPJPY": -0.08,
    "AUDUSD": 0.01,
}

# Baseline win probability by entry hour (UTC), so session performance is
# discoverable too: London/NY overlap trades slightly out-perform.
def _session_edge(hour: int) -> float:
    if 13 <= hour < 16:
        return 0.10
    if 8 <= hour < 13 or 16 <= hour < 21:
        return 0.02
    return -0.06


def _pick_bool(p: float, rng: random.Random) -> bool:
    return rng.random() < p


def generate_trades(count: int, seed: int, start_days_ago: int = 120) -> list[TradeRecord]:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    trades: list[TradeRecord] = []

    for i in range(count):
        symbol = rng.choice(SYMBOLS)
        timeframe = rng.choice(TIMEFRAMES)
        direction = rng.choice(["buy", "sell"])

        entry_offset_minutes = rng.randint(0, start_days_ago * 24 * 60)
        entry_time = now - timedelta(minutes=(start_days_ago * 24 * 60 - entry_offset_minutes))
        duration_minutes = rng.randint(15, 600)
        exit_time = entry_time + timedelta(minutes=duration_minutes)

        entry_price = round(rng.uniform(0.8, 200.0), 5)
        atr = round(entry_price * rng.uniform(0.0015, 0.01), 5)
        spread = round(atr * rng.uniform(0.02, 0.1), 5)
        volume = round(rng.uniform(100, 5000), 1)
        trend = rng.choice(["up", "down", "sideways"])

        bos = _pick_bool(0.45, rng)
        choch = _pick_bool(0.3, rng)
        order_block = _pick_bool(0.4, rng)
        fair_value_gap = _pick_bool(0.35, rng)
        liquidity_sweep = _pick_bool(0.3, rng)

        strategy_tags = rng.sample(STRATEGY_TAG_POOL, k=rng.randint(1, 2))
        risk_reward_planned = round(rng.uniform(1.0, 3.5), 2)
        confidence_at_entry = round(rng.uniform(0.3, 0.9), 2)

        # Build a genuinely learnable win probability from the features
        # above, so the trained model has real signal to find.
        base = 0.45
        base += _SYMBOL_EDGE.get(symbol, 0.0)
        base += _session_edge(entry_time.hour)
        base += 0.08 if (bos and order_block) else 0.0
        base += 0.06 if fair_value_gap else 0.0
        base -= 0.10 if (choch and liquidity_sweep) else 0.0
        base += 0.05 if risk_reward_planned >= 2.0 else -0.03
        win_probability = max(0.05, min(0.9, base))

        is_win = rng.random() < win_probability
        if is_win:
            pnl = round(volume * 0.0001 * risk_reward_planned * rng.uniform(0.8, 1.2), 2)
            outcome = "win"
        else:
            if rng.random() < 0.08:
                pnl = 0.0
                outcome = "breakeven"
            else:
                pnl = -round(volume * 0.0001 * rng.uniform(0.8, 1.2), 2)
                outcome = "loss"

        trade = TradeRecord(
            trade_id=str(uuid.uuid4()),
            symbol=symbol,
            timeframe=timeframe,
            direction=direction,
            entry_time=entry_time,
            exit_time=exit_time,
            entry_price=entry_price,
            exit_price=entry_price + (atr if is_win else -atr) * (1 if direction == "buy" else -1),
            stop_loss=entry_price - atr if direction == "buy" else entry_price + atr,
            take_profit=entry_price + atr * risk_reward_planned if direction == "buy" else entry_price - atr * risk_reward_planned,
            lot_size=round(rng.uniform(0.01, 1.0), 2),
            atr=atr,
            spread=spread,
            volume=volume,
            trend=trend,
            bos=bos,
            choch=choch,
            order_block=order_block,
            fair_value_gap=fair_value_gap,
            liquidity_sweep=liquidity_sweep,
            strategy_tags=strategy_tags,
            risk_reward_planned=risk_reward_planned,
            confidence_at_entry=confidence_at_entry,
            pnl=pnl,
            outcome=outcome,
            is_closed=True,
        )
        trades.append(trade)

    trades.sort(key=lambda t: t.entry_time)
    return trades


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=300, help="Number of synthetic trades to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    trades = generate_trades(args.count, args.seed)
    print(f"Generated {len(trades)} synthetic trades, feeding through ai_brain.record_trade()...")
    for i, trade in enumerate(trades, start=1):
        ai_brain.record_trade(trade)
        if i % 50 == 0:
            print(f"  ...{i}/{len(trades)} recorded")

    print("Done. Run `python -m ai_brain.model_trainer --retrain` if an automatic retrain wasn't triggered.")


if __name__ == "__main__":
    main()
