#!/usr/bin/env python3
"""Standalone Telegram bot exposing read-only AI Brain intelligence.

Runs as its own process, independent of the trading bot and independent
of whether ``ai_brain.record_trade``/``get_prediction`` are being called
by anything at all — it only reads current state from the AI Brain's own
database, dataset, and models. It never places trades and never mutates
trading state; ``/retrain`` is the only command that changes anything,
and it only ever triggers the same safe, validated retrain pipeline
``model_trainer.retrain`` uses everywhere else (train/val/test + walk
forward, promote only if it beats the current active model).

Configure via env vars: ``AI_BRAIN_TELEGRAM_BOT_TOKEN`` (required to run)
and optionally ``AI_BRAIN_TELEGRAM_ALLOWED_CHAT_IDS`` (comma-separated
chat IDs; if unset, any chat can use the bot — set this in production).

Run with: python -m ai_brain.telegram_bot
"""

from __future__ import annotations

import asyncio
import functools
from datetime import datetime, timezone
from uuid import uuid4

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

import ai_brain
from ai_brain import dataset_builder, learning_manager, model_manager, model_trainer, pattern_engine
from ai_brain.config import CONFIG
from ai_brain.explain_ai import feature_importance_builtin
from ai_brain.feature_engine import CandidateTrade
from ai_brain.utils import get_logger

logger = get_logger(__name__)


def _authorized(chat_id: int) -> bool:
    if not CONFIG.TELEGRAM_ALLOWED_CHAT_IDS:
        return True
    return chat_id in CONFIG.TELEGRAM_ALLOWED_CHAT_IDS


def _require_auth(handler):
    @functools.wraps(handler)
    async def wrapped(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not update.effective_chat or not _authorized(update.effective_chat.id):
            await update.message.reply_text("Not authorized.")
            return
        await handler(update, context)

    return wrapped


async def _run_blocking(fn, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, fn, *args)


@_require_auth
async def cmd_ai_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    status = await _run_blocking(learning_manager.get_trainer_status)
    total_trades = await _run_blocking(lambda: len(dataset_builder.get_closed_trades_df()))

    lines = [
        f"AI Brain: {'ENABLED' if ai_brain.is_enabled() else 'DISABLED'}",
        f"Active model: {status['active_version'] or 'none trained yet'}",
        f"Total closed trades recorded: {total_trades}",
        f"Trades since last train: {status['trades_since_last_train']}",
        f"Last train at: {status['last_train_at'] or 'never'}",
        f"Retrain due: {status['retrain_due']} ({status['retrain_due_reason']})",
    ]
    await update.message.reply_text("\n".join(lines))


@_require_auth
async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    versions = await _run_blocking(model_manager.list_versions)
    if not versions:
        await update.message.reply_text("No models trained yet.")
        return

    lines = ["Model versions:"]
    for v in versions:
        combined = v.metrics.get("combined_score")
        combined_str = f"{combined:.3f}" if isinstance(combined, (int, float)) else "n/a"
        marker = " (ACTIVE)" if v.is_active else ""
        lines.append(
            f"- {v.version}{marker}: trained {v.trained_at}, {v.trades_used} trades, "
            f"combined_score={combined_str}, trigger={v.trigger_reason}"
        )
    await update.message.reply_text("\n".join(lines))


@_require_auth
async def cmd_retrain(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("Starting retrain (train/validation/test + walk-forward)...")
    try:
        result = await _run_blocking(model_trainer.retrain, "telegram_manual")
    except ValueError as e:
        await update.message.reply_text(f"Could not retrain: {e}")
        return
    except Exception:
        logger.exception("Retrain triggered from Telegram failed.")
        await update.message.reply_text("Retrain failed; check logs.")
        return

    combined = result.metrics.get("combined_score", float("nan"))
    status = "PROMOTED to active" if result.accepted else f"kept as candidate ({result.rejected_reason})"
    await update.message.reply_text(
        f"Retrain complete: model {result.version}, combined_score={combined:.3f}, {status}"
    )


@_require_auth
async def cmd_predict(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Demo prediction on a synthetic 'right now' candidate trade.

    A real trading bot would call ai_brain.get_prediction() directly with
    its actual candidate trade; this command exists so the pipeline can
    be exercised interactively from Telegram without wiring up MT5.
    """
    symbol = context.args[0].upper() if context.args else "EURUSD"
    candidate = CandidateTrade(
        trade_id=f"telegram-demo-{uuid4()}",
        symbol=symbol,
        timeframe="H1",
        direction="buy",
        entry_time=datetime.now(timezone.utc),
        entry_price=1.0,
        stop_loss=0.995,
        take_profit=1.01,
        atr=0.003,
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
        confidence_at_entry=0.6,
    )
    decision = await _run_blocking(ai_brain.get_prediction, candidate)

    lines = [
        f"Demo prediction for {symbol} (synthetic candidate, not a real trade):",
        f"Recommendation: {decision.recommendation} (quality={decision.trade_quality})",
        f"Confidence: {decision.final_confidence:.0%}",
        f"Win probability: {decision.win_probability:.0%}",
        f"Expected RR: {decision.expected_rr:.2f}, Expected profit: {decision.expected_profit:.2f}",
        f"Summary: {decision.explanation.summary}",
    ]
    if decision.warnings:
        lines.append("Warnings: " + "; ".join(decision.warnings))
    await update.message.reply_text("\n".join(lines))


@_require_auth
async def cmd_patterns(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    report = await _run_blocking(pattern_engine.generate_pattern_report)

    def fmt(stats):
        return ", ".join(f"{s.group_value} ({s.win_rate:.0%}, n={s.sample_size})" for s in stats) or "n/a"

    lines = [
        f"Pattern report ({report.sample_size} closed trades, overall win rate {report.overall_win_rate:.0%}):",
        f"Best sessions: {fmt(report.best_sessions)}",
        f"Worst sessions: {fmt(report.worst_sessions)}",
        f"Best symbols: {fmt(report.best_symbols)}",
        f"Worst symbols: {fmt(report.worst_symbols)}",
        f"Best timeframes: {fmt(report.best_timeframes)}",
        f"Best strategy combos: {fmt(report.best_tag_combos)}",
    ]
    if report.high_risk_situations:
        lines.append("High-risk situations: " + "; ".join(report.high_risk_situations[:5]))
    if report.recurring_losing_patterns:
        lines.append("Recurring losing patterns: " + "; ".join(report.recurring_losing_patterns[:5]))
    await update.message.reply_text("\n".join(lines))


@_require_auth
async def cmd_feature_importance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    try:
        bundle = await _run_blocking(model_manager.load_model)
    except model_manager.NoModelAvailableError:
        await update.message.reply_text("No trained model yet.")
        return

    top_features = feature_importance_builtin(bundle, CONFIG.EXPLAIN_TOP_N_FEATURES)
    lines = [f"Top features for model {bundle.version}:"]
    lines += [f"- {f.feature}: {f.importance:.4f}" for f in top_features]
    await update.message.reply_text("\n".join(lines))


@_require_auth
async def cmd_learning(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = await _run_blocking(learning_manager.compute_learning_stats)

    def pct(x):
        return f"{x:.0%}" if x == x else "n/a"  # NaN check

    lines = [
        "Learning progress:",
        f"Recent prediction accuracy: {pct(stats.recent_accuracy)} (n={stats.recent_sample_size})",
        f"Long-term prediction accuracy: {pct(stats.long_term_accuracy)} (n={stats.long_term_sample_size})",
        f"Current win rate (recent window): {pct(stats.current_win_rate)}",
        f"Active model: {stats.active_model_version or 'none'} (trained {stats.active_model_trained_at or 'n/a'})",
    ]
    await update.message.reply_text("\n".join(lines))


@_require_auth
async def cmd_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    status = await _run_blocking(learning_manager.get_trainer_status)
    learning_stats = await _run_blocking(learning_manager.compute_learning_stats)
    report = await _run_blocking(pattern_engine.generate_pattern_report)

    def pct(x):
        return f"{x:.0%}" if x == x else "n/a"

    active = status["active_version"]
    active_meta = next((v for v in status["model_versions"] if v["version"] == active), None)
    test_acc = None
    if active_meta:
        test_acc = active_meta["metrics"].get("test", {}).get("accuracy")

    lines = [
        "=== MMXM AI Brain Dashboard ===",
        f"AI Brain: {'ENABLED' if ai_brain.is_enabled() else 'DISABLED'}",
        f"Model version: {active or 'none'}",
        f"Training date: {active_meta['trained_at'] if active_meta else 'n/a'}",
        f"Model test accuracy: {f'{test_acc:.0%}' if isinstance(test_acc, (int, float)) else 'n/a'}",
        f"Prediction accuracy (recent/long-term): {pct(learning_stats.recent_accuracy)} / {pct(learning_stats.long_term_accuracy)}",
        f"Current win rate: {pct(learning_stats.current_win_rate)}",
        f"Account-wide historical win rate: {pct(report.overall_win_rate)} (n={report.sample_size})",
        f"Learning progress: {status['trades_since_last_train']} trades since last train "
        f"(retrains every {CONFIG.RETRAIN_EVERY_N_TRADES})",
        f"Best symbol: {report.best_symbols[0].group_value if report.best_symbols else 'n/a'}",
        f"Worst symbol: {report.worst_symbols[0].group_value if report.worst_symbols else 'n/a'}",
    ]
    await update.message.reply_text("\n".join(lines))


def build_application() -> Application:
    if not CONFIG.TELEGRAM_BOT_TOKEN:
        raise RuntimeError(
            "AI_BRAIN_TELEGRAM_BOT_TOKEN is not set; cannot start the Telegram bot."
        )

    application = Application.builder().token(CONFIG.TELEGRAM_BOT_TOKEN).build()
    application.add_handler(CommandHandler("ai_status", cmd_ai_status))
    application.add_handler(CommandHandler("model", cmd_model))
    application.add_handler(CommandHandler("retrain", cmd_retrain))
    application.add_handler(CommandHandler("predict", cmd_predict))
    application.add_handler(CommandHandler("patterns", cmd_patterns))
    application.add_handler(CommandHandler("feature_importance", cmd_feature_importance))
    application.add_handler(CommandHandler("learning", cmd_learning))
    application.add_handler(CommandHandler("dashboard", cmd_dashboard))
    return application


def main() -> None:
    if not CONFIG.TELEGRAM_ALLOWED_CHAT_IDS:
        logger.warning(
            "AI_BRAIN_TELEGRAM_ALLOWED_CHAT_IDS is not set; the bot will respond to any chat. "
            "Set it in production."
        )
    application = build_application()
    logger.info("MMXM AI Brain Telegram bot starting (polling)...")
    application.run_polling()


if __name__ == "__main__":
    main()
