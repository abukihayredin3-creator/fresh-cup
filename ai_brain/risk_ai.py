"""Position sizing and risk recommendations — advisory only.

This module NEVER executes anything and structurally cannot increase a
bot-owned lot size: ``recommended_lot_size`` is always
``min(computed_lot, bot_provided_lot_size)`` whenever the bot supplies its
own lot size. It also never proposes a risk percent above the caller's
own ``max_risk_percent`` or the hard global ``CONFIG.MAX_RISK_PERCENT``
ceiling, whichever is lower. Pure function, no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass

from ai_brain.config import CONFIG


@dataclass
class AccountRiskSettings:
    account_balance: float
    max_risk_percent: float
    max_drawdown_percent: float
    current_drawdown_percent: float = 0.0
    bot_provided_lot_size: float | None = None
    stop_loss_distance_points: float | None = None
    point_value: float | None = None


@dataclass
class RiskRecommendation:
    recommended_risk_percent: float
    recommended_lot_size: float | None
    recommended_rr: float
    max_risk_percent_allowed: float
    rationale: str
    capped: bool


def _drawdown_factor(settings: AccountRiskSettings) -> float:
    if settings.max_drawdown_percent <= 0 or settings.current_drawdown_percent <= 0:
        return 1.0
    ratio = settings.current_drawdown_percent / settings.max_drawdown_percent
    # Never fully zero out risk from drawdown alone; floor at 25% of the
    # otherwise-recommended size so a recovering account can still trade.
    return max(0.25, 1.0 - ratio)


def _breakeven_rr(win_probability: float | None, planned_rr: float) -> float:
    """Simplified breakeven-RR heuristic: the minimum reward:risk needed
    for the trade to be expected-value-neutral at this win probability.
    Deliberately not full Kelly sizing — that would recommend far more
    aggressive sizing than is appropriate for an advisory-only module.
    """
    if not win_probability or win_probability <= 0 or win_probability >= 1:
        return planned_rr
    breakeven = (1 - win_probability) / win_probability
    return max(planned_rr, breakeven)


def recommend(
    trade_quality_score: float,
    confidence: float,
    settings: AccountRiskSettings,
    planned_rr: float,
    win_probability: float | None = None,
) -> RiskRecommendation:
    allowed_max = min(settings.max_risk_percent, CONFIG.MAX_RISK_PERCENT)
    allowed_max = max(allowed_max, CONFIG.MIN_RISK_PERCENT)

    quality_signal = max(0.0, min(1.0, (trade_quality_score + confidence) / 2))
    scaled_risk = CONFIG.MIN_RISK_PERCENT + (allowed_max - CONFIG.MIN_RISK_PERCENT) * quality_signal

    drawdown_factor = _drawdown_factor(settings)
    scaled_risk *= drawdown_factor

    recommended_risk_percent = max(CONFIG.MIN_RISK_PERCENT, min(allowed_max, scaled_risk))
    recommended_rr = _breakeven_rr(win_probability, planned_rr)

    recommended_lot_size = None
    capped = False
    if (
        settings.stop_loss_distance_points
        and settings.point_value
        and settings.stop_loss_distance_points > 0
        and settings.point_value > 0
    ):
        risk_amount = settings.account_balance * (recommended_risk_percent / 100.0)
        computed_lot = risk_amount / (settings.stop_loss_distance_points * settings.point_value)

        if settings.bot_provided_lot_size is not None:
            capped = computed_lot > settings.bot_provided_lot_size
            recommended_lot_size = min(computed_lot, settings.bot_provided_lot_size)
        else:
            recommended_lot_size = computed_lot

    rationale = (
        f"Risk scaled to {recommended_risk_percent:.2f}% (of {allowed_max:.2f}% max allowed) "
        f"from quality/confidence signal {quality_signal:.2f}"
    )
    if drawdown_factor < 1.0:
        rationale += f", reduced {(1 - drawdown_factor):.0%} for current drawdown"
    if capped:
        rationale += "; lot size capped at bot-provided value (never increased)"

    return RiskRecommendation(
        recommended_risk_percent=recommended_risk_percent,
        recommended_lot_size=recommended_lot_size,
        recommended_rr=recommended_rr,
        max_risk_percent_allowed=allowed_max,
        rationale=rationale,
        capped=capped,
    )
