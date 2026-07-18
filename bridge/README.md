# MMXM MT5 Bridge

The Python bridge between the MetaTrader 5 EA (`mt5_ea/`) and `ai_brain/`.
It contains the only "intelligence-adjacent" logic outside `ai_brain`
itself: deterministic market-structure detection (`smc_features.py`) and
the execution-rule gate (`risk_gate.py`). It never overrides `ai_brain`'s
judgment upward — it can only turn a favorable recommendation into a
rejection, never the reverse.

## Architecture

```
EA --POST /predict--> [pre-checks] --> [smc_features.detect] --> [build CandidateTrade]
                                                                        |
                                                                        v
                                                          ai_brain.get_prediction()
                                                                        |
                                                                        v
                                    [post-checks: confidence threshold + favorable?]
                                                    |                        |
                                              approved                  rejected
                                                    |                        |
                                    BUY/SELL + lot/SL/TP           HOLD + rejected_reason
                                    (+ save pending context)

EA --POST /trade_result--> [recall pending context] --> build TradeRecord --> ai_brain.record_trade()
```

See `ai_brain/README.md` for the AI Brain's own contract; this bridge
never modifies `ai_brain/`, it only calls its public interface
(`ai_brain.get_prediction`, `ai_brain.record_trade`).

## Installation

```bash
pip install -r bridge/requirements.txt   # separate from ai_brain's own requirements.txt
pip install -r requirements.txt          # ai_brain's dependencies, also needed
```

Note: `bridge/requirements.txt` pins `httpx>=0.26,<0.27` specifically to
stay compatible with `python-telegram-bot`'s own httpx pin when both are
installed in the same environment (as in this repo's dev venv). If you
deploy the bridge in its own isolated environment without
`ai_brain/telegram_bot.py`, a newer `httpx` is fine too.

## Running

```bash
python -m bridge.main
```

Reads `host`/`port` from `config/bridge_config.yaml` (defaults to
`127.0.0.1:8000`). Logs to `bridge/logs/bridge.log` (rotating, gitignored).

## Configuration

- **`config/bridge_config.yaml`** — server host/port; risk sizing
  (`max_risk_percent`, lot bounds, `sl_atr_multiplier`, `default_rr`);
  execution gate thresholds (`confidence_threshold`, `max_open_positions`,
  per-symbol `max_spread_points`, `allowed_symbols`, `allowed_sessions`,
  `trading_hours`); `news_filter.enabled`.
- **`config/news_blackout.yaml`** — manual list of `{symbol, start_utc,
  end_utc, reason}` windows during which new trades on that symbol are
  refused. No live economic-calendar API is wired up; populate this from
  whatever calendar source you already use.

Edit either file and restart the bridge process to apply changes.

## API

### `GET /health`
```json
{"status": "ok", "ai_brain_enabled": true}
```

### `POST /predict`
Request (abridged — see `bridge/schemas.py:PredictRequest` for the full
shape): raw OHLC window, spread, ATR, account info, existing positions,
`point_value`. No direction, no SMC flags — the bridge derives all
structure signals from `ohlc` itself.

Response:
```json
{
  "request_id": "...",
  "action": "BUY",
  "confidence": 0.78,
  "lot_size": 0.05,
  "stop_loss": 1.0950,
  "take_profit": 1.1050,
  "risk_percent": 1.1,
  "explanation": "Favorable setup at 78% confidence ...",
  "rejected_reason": null
}
```

`action` is always `"BUY" | "SELL" | "HOLD"`. When `"HOLD"`,
`rejected_reason` is one of: `symbol_not_allowed`, `outside_trading_hours`,
`session_not_allowed`, `max_positions_reached`, `spread_too_wide`,
`news_blackout`, `insufficient_bar_data`, `no_directional_signal`,
`ai_brain_insufficient_data`, `ai_brain_disabled`,
`ai_recommendation_not_favorable`, `confidence_below_threshold`.

### `POST /trade_result`
Sent when a position closes. See
`bridge/schemas.py:TradeResultRequest` for the full shape — only fields
the EA itself knows at close time (prices, PnL, timing, exit reason,
MFE/MAE, drawdown). The original SMC/candidate context is recalled from
`bridge/trade_state.py` by `trade_id`, not resent by the EA.

## Testing

```bash
pytest bridge/tests -q
```

Tests isolate both the bridge's own config (`tmp_bridge_config` fixture)
and `ai_brain`'s config (`tmp_ai_brain_config` fixture) into per-test tmp
directories — no real data/models/logs are touched. The `/predict`
approved/rejected-by-AI paths are tested by monkeypatching
`ai_brain.get_prediction` with a controlled `AIDecision` (ai_brain's own
ML behavior is already covered by its own test suite; these tests verify
the bridge's wiring). The zero-model and trade-recording paths use the
real `ai_brain` package end to end.

Run `pytest tests -q` from the repo root afterward to confirm `ai_brain`'s
own suite is still green and untouched.

## Module map

| Module | Responsibility |
|---|---|
| `config.py` | Loads `config/bridge_config.yaml` + `news_blackout.yaml` |
| `logging_setup.py` | Rotating `bridge/logs/bridge.log` + structured `log_event` |
| `smc_features.py` | Deterministic BOS/CHOCH/order block/FVG/liquidity-sweep/trend detection from OHLC |
| `schemas.py` | Pydantic request/response models (the JSON contract) |
| `risk_gate.py` | Execution-rule gate (pre-checks before calling ai_brain, post-checks after) |
| `trade_state.py` | Persists approved-candidate context for `/trade_result` to recall |
| `translator.py` | Builds `CandidateTrade`/`TradeRecord`, turns `AIDecision` into a response |
| `app.py` | FastAPI routes: `/predict`, `/trade_result`, `/health` |
| `main.py` | uvicorn entrypoint |
