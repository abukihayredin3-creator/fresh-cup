"""Data-driven pattern discovery over closed-trade history.

Everything here is plain pandas groupby/aggregation over actual trade
outcomes — there are no hardcoded trading rules. "Best session" means
"the session with the highest historical win rate at sufficient sample
size in this account's own trade history," nothing more.

"Significance" is a simple sample-size bucket (config-tunable thresholds),
not a real statistical test (e.g. a binomial confidence interval or
chi-squared test). That's a reasonable v1 choice for something surfaced
mainly as an explainability aid; a real significance test is a natural
stretch-goal upgrade if pattern claims need statistical rigor later.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from itertools import combinations

import pandas as pd

from ai_brain import dataset_builder
from ai_brain.config import CONFIG
from ai_brain.feature_engine import TradeFeatures, encode_strategy_tags
from ai_brain.utils import from_iso, get_logger, get_session, utcnow

logger = get_logger(__name__)


@dataclass
class GroupStat:
    group_value: str
    win_rate: float
    avg_pnl: float
    avg_rr: float
    sample_size: int
    expected_value: float
    significance: str  # "low" | "medium" | "high"


@dataclass
class PatternReport:
    best_sessions: list[GroupStat]
    worst_sessions: list[GroupStat]
    best_symbols: list[GroupStat]
    worst_symbols: list[GroupStat]
    best_timeframes: list[GroupStat]
    worst_timeframes: list[GroupStat]
    best_tag_combos: list[GroupStat]
    worst_tag_combos: list[GroupStat]
    high_risk_situations: list[str]
    recurring_losing_patterns: list[str]
    session_stats: dict[str, GroupStat] = field(default_factory=dict)
    symbol_stats: dict[str, GroupStat] = field(default_factory=dict)
    timeframe_stats: dict[str, GroupStat] = field(default_factory=dict)
    tag_hash_lookup: dict[int, float] = field(default_factory=dict)
    overall_win_rate: float = 0.0
    sample_size: int = 0
    generated_at: str = ""


@dataclass
class PatternStats:
    session_win_rate: float
    symbol_win_rate: float
    timeframe_win_rate: float
    strategy_tag_win_rate: float
    sample_size: int
    matched_patterns: list[str]
    high_risk_flags: list[str]


def _significance(sample_size: int, min_sample: int) -> str:
    if sample_size >= min_sample * 3:
        return "high"
    if sample_size >= min_sample:
        return "medium"
    return "low"


def _prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.dropna(subset=["pnl", "risk_reward_planned", "outcome"])
    df["win"] = (df["outcome"] == "win").astype(int)
    df["session"] = df["entry_time"].apply(lambda s: get_session(from_iso(s)))
    df["tag_combo"] = df["strategy_tags"].apply(
        lambda s: " + ".join(sorted(json.loads(s))) if s else "none"
    )
    df["tag_hash"] = df["strategy_tags"].apply(
        lambda s: encode_strategy_tags(json.loads(s)) if s else 0
    )
    return df


def compute_group_stats(df: pd.DataFrame, group_col: str, min_sample: int | None = None) -> list[GroupStat]:
    """Win rate / avg PnL / avg RR / sample size per value of ``group_col``."""
    min_sample = min_sample if min_sample is not None else CONFIG.PATTERN_MIN_SAMPLE_SIZE
    if df.empty or group_col not in df.columns:
        return []

    grouped = df.groupby(group_col).agg(
        win_rate=("win", "mean"),
        avg_pnl=("pnl", "mean"),
        avg_rr=("risk_reward_planned", "mean"),
        sample_size=("win", "count"),
    )

    stats = []
    for value, row in grouped.iterrows():
        stats.append(
            GroupStat(
                group_value=str(value),
                win_rate=float(row["win_rate"]),
                avg_pnl=float(row["avg_pnl"]),
                avg_rr=float(row["avg_rr"]),
                sample_size=int(row["sample_size"]),
                expected_value=float(row["avg_pnl"]),
                significance=_significance(int(row["sample_size"]), min_sample),
            )
        )
    return stats


def best_and_worst(stats: list[GroupStat], min_sample: int | None = None, top_n: int = 3) -> tuple[list[GroupStat], list[GroupStat]]:
    min_sample = min_sample if min_sample is not None else CONFIG.PATTERN_MIN_SAMPLE_SIZE
    eligible = [s for s in stats if s.sample_size >= min_sample]
    ranked = sorted(eligible, key=lambda s: s.win_rate, reverse=True)
    best = ranked[:top_n]
    worst = list(reversed(ranked[-top_n:])) if ranked else []
    return best, worst


def _find_high_risk_situations(df: pd.DataFrame, overall_win_rate: float) -> list[str]:
    """Symbol x session combos with a materially worse win rate than the
    account-wide average, at sufficient sample size."""
    situations = []
    if df.empty:
        return situations

    grouped = df.groupby(["symbol", "session"]).agg(
        win_rate=("win", "mean"), sample_size=("win", "count")
    )
    for (symbol, session), row in grouped.iterrows():
        if row["sample_size"] < CONFIG.PATTERN_MIN_SAMPLE_SIZE:
            continue
        if overall_win_rate - row["win_rate"] >= CONFIG.PATTERN_HIGH_RISK_WIN_RATE_DELTA:
            situations.append(
                f"{symbol} during {session}: {row['win_rate']:.0%} win rate "
                f"(n={int(row['sample_size'])}, account avg {overall_win_rate:.0%})"
            )
    return situations


def _find_recurring_losing_patterns(df: pd.DataFrame) -> list[str]:
    """SMC signal combinations that recur in losing trades at a
    meaningfully worse-than-average win rate."""
    patterns = []
    if df.empty:
        return patterns

    flag_cols = ["bos", "choch", "order_block", "fair_value_gap", "liquidity_sweep"]
    overall_win_rate = df["win"].mean()

    for r in (1, 2):
        for combo in combinations(flag_cols, r):
            mask = (df[list(combo)] == 1).all(axis=1)
            subset = df[mask]
            if len(subset) < CONFIG.PATTERN_MIN_SAMPLE_SIZE:
                continue
            win_rate = subset["win"].mean()
            if overall_win_rate - win_rate >= CONFIG.PATTERN_HIGH_RISK_WIN_RATE_DELTA:
                label = " + ".join(c.replace("_", " ") for c in combo)
                patterns.append(
                    f"{label}: {win_rate:.0%} win rate (n={len(subset)}, account avg {overall_win_rate:.0%})"
                )
    return patterns


def generate_pattern_report(df: pd.DataFrame | None = None) -> PatternReport:
    if df is None:
        df = dataset_builder.get_closed_trades_df()

    if df.empty:
        return PatternReport(
            best_sessions=[], worst_sessions=[],
            best_symbols=[], worst_symbols=[],
            best_timeframes=[], worst_timeframes=[],
            best_tag_combos=[], worst_tag_combos=[],
            high_risk_situations=[], recurring_losing_patterns=[],
            generated_at=utcnow().isoformat(),
        )

    df = _prepare(df)
    overall_win_rate = float(df["win"].mean())

    session_stats_list = compute_group_stats(df, "session")
    symbol_stats_list = compute_group_stats(df, "symbol")
    timeframe_stats_list = compute_group_stats(df, "timeframe")
    tag_stats_list = compute_group_stats(df, "tag_combo")

    best_sessions, worst_sessions = best_and_worst(session_stats_list)
    best_symbols, worst_symbols = best_and_worst(symbol_stats_list)
    best_timeframes, worst_timeframes = best_and_worst(timeframe_stats_list)
    best_tag_combos, worst_tag_combos = best_and_worst(tag_stats_list)

    tag_hash_lookup = {
        int(h): float(w)
        for h, w in df.groupby("tag_hash")["win"].mean().items()
    }

    return PatternReport(
        best_sessions=best_sessions,
        worst_sessions=worst_sessions,
        best_symbols=best_symbols,
        worst_symbols=worst_symbols,
        best_timeframes=best_timeframes,
        worst_timeframes=worst_timeframes,
        best_tag_combos=best_tag_combos,
        worst_tag_combos=worst_tag_combos,
        high_risk_situations=_find_high_risk_situations(df, overall_win_rate),
        recurring_losing_patterns=_find_recurring_losing_patterns(df),
        session_stats={s.group_value: s for s in session_stats_list},
        symbol_stats={s.group_value: s for s in symbol_stats_list},
        timeframe_stats={s.group_value: s for s in timeframe_stats_list},
        tag_hash_lookup=tag_hash_lookup,
        overall_win_rate=overall_win_rate,
        sample_size=len(df),
        generated_at=utcnow().isoformat(),
    )


def lookup_context(features: TradeFeatures, report: PatternReport | None = None) -> PatternStats:
    """Look up historical statistical context for one candidate trade's features."""
    report = report or generate_pattern_report()

    session_stat = report.session_stats.get(features.session)
    symbol_stat = report.symbol_stats.get(features.symbol)
    timeframe_stat = report.timeframe_stats.get(features.timeframe)

    session_win_rate = session_stat.win_rate if session_stat else report.overall_win_rate
    symbol_win_rate = symbol_stat.win_rate if symbol_stat else report.overall_win_rate
    timeframe_win_rate = timeframe_stat.win_rate if timeframe_stat else report.overall_win_rate
    strategy_tag_win_rate = report.tag_hash_lookup.get(features.strategy_tag_hash, report.overall_win_rate)

    sample_sizes = [s.sample_size for s in (session_stat, symbol_stat, timeframe_stat) if s is not None]
    sample_size = min(sample_sizes) if sample_sizes else 0

    matched_patterns = []
    for stat in report.best_sessions + report.best_symbols + report.best_timeframes + report.best_tag_combos:
        if stat.group_value in (features.session, features.symbol, features.timeframe):
            matched_patterns.append(
                f"Matches historically strong pattern '{stat.group_value}': "
                f"{stat.win_rate:.0%} win rate (n={stat.sample_size})"
            )

    high_risk_flags = [
        s for s in report.high_risk_situations
        if features.symbol in s or features.session in s
    ]

    return PatternStats(
        session_win_rate=session_win_rate,
        symbol_win_rate=symbol_win_rate,
        timeframe_win_rate=timeframe_win_rate,
        strategy_tag_win_rate=strategy_tag_win_rate,
        sample_size=sample_size,
        matched_patterns=matched_patterns,
        high_risk_flags=high_risk_flags,
    )
