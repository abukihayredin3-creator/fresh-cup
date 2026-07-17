# MMXM AI Brain v1.0

A standalone, self-learning ML intelligence module for the MMXM trading
platform. It **never executes trades** — it only provides advisory
predictions, statistics, and explanations. The existing trading bot
continues to work identically whether the AI Brain is enabled, disabled,
or not integrated at all.

## Safety guarantee

`ai_brain/` never imports `MetaTrader5`/`mt5` or any broker/execution
library. Every output is a plain data object (`AIDecision`,
`RiskRecommendation`, ...) — never an order, SL/TP, or lot-size mutation.
`risk_ai`'s recommended lot size is always `min(computed, bot_provided)`
when a bot-owned lot size is supplied — it structurally cannot increase
it. This is enforced by `tests/test_no_mt5_imports.py`, which scans the
package source and fails if an MT5 import ever appears.

## Integrating with a real trading bot

The public contract is deliberately small:

```python
import ai_brain
from ai_brain import TradeRecord, CandidateTrade, AccountRiskSettings

# When a trade closes:
ai_brain.record_trade(TradeRecord(
    trade_id=..., symbol=..., timeframe=..., direction=...,
    entry_time=..., exit_time=..., entry_price=..., exit_price=...,
    stop_loss=..., take_profit=..., lot_size=..., atr=..., spread=..., volume=...,
    trend=...,                 # "up" | "down" | "sideways"
    bos=..., choch=..., order_block=..., fair_value_gap=..., liquidity_sweep=...,  # bool
    strategy_tags=[...], risk_reward_planned=..., confidence_at_entry=...,
    pnl=..., outcome=...,      # "win" | "loss" | "breakeven"
))

# Before/while considering a trade:
decision = ai_brain.get_prediction(
    CandidateTrade(trade_id=..., symbol=..., timeframe=..., direction=..., entry_time=...,
                    entry_price=..., stop_loss=..., take_profit=..., atr=..., spread=..., volume=...,
                    trend=..., bos=..., choch=..., order_block=..., fair_value_gap=..., liquidity_sweep=...,
                    strategy_tags=[...], risk_reward_planned=...),
    account_risk=AccountRiskSettings(account_balance=..., max_risk_percent=..., max_drawdown_percent=...),
)
print(decision.recommendation, decision.final_confidence, decision.explanation.summary)
```

Both functions are exception-safe: nothing raised inside the AI Brain
ever propagates to the caller. `ai_brain.disable()` turns the module off
entirely; `record_trade`/`get_prediction` become safe no-ops/neutral
responses. See `ai_brain/feature_engine.py` for the exact field types of
`TradeRecord`/`CandidateTrade`.

## Trying it without a real bot

```bash
pip install -r requirements.txt
python scripts/generate_sample_trades.py     # feeds ~300 synthetic closed trades through record_trade()
pytest -q                                     # full test suite, including the MT5-import safety scan
python -m ai_brain.telegram_bot               # optional: set AI_BRAIN_TELEGRAM_BOT_TOKEN first
```

## Module map

| Module | Responsibility |
|---|---|
| `config.py` | Central config (paths, thresholds, feature flags) |
| `utils.py` | Logging, SQLite access, atomic I/O, time helpers |
| `feature_engine.py` | `TradeRecord`/`CandidateTrade`/`TradeFeatures` contracts + feature derivation |
| `market_regime.py` | Trending/ranging/volatile/quiet classification |
| `dataset_builder.py` | Persists closed trades, maintains `training_dataset.csv` |
| `xgboost_engine.py` | Model fit/predict/evaluate |
| `model_manager.py` | Versioned model save/load/rollback |
| `model_trainer.py` | Retrain triggers, walk-forward validation, promotion |
| `prediction_engine.py` | Loads active model, scores candidate trades |
| `pattern_engine.py` | Data-driven best/worst session/symbol/pattern discovery |
| `confidence_engine.py` | Blends model + historical confidence |
| `risk_ai.py` | Advisory position sizing (never increases bot lot size) |
| `ai_decision_engine.py` | Orchestrates everything into one `AIDecision` |
| `explain_ai.py` | Feature importance, historical evidence, probability breakdown |
| `learning_manager.py` | Prediction-vs-outcome reconciliation, accuracy tracking |
| `telegram_bot.py` | Standalone read-mostly Telegram bot (`/ai_status`, `/model`, `/retrain`, `/predict`, `/patterns`, `/feature_importance`, `/learning`, `/dashboard`) |

## Data layout

- `data/trade_history.db` — SQLite, source of truth for closed trades, prediction log, training run history
- `data/training_dataset.csv` — derived, engineered feature view used for training
- `data/snapshots/` — exact training data snapshot per model version, for reproducibility
- `models/model_vN.pkl` — versioned model bundles, never overwritten
- `models/registry.json` — version metadata + active version
- `logs/ai_brain.log` — rotating log file
