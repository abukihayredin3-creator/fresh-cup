# MMXM AI Brain EA (MetaTrader 5)

A MetaTrader 5 Expert Advisor with **no trading logic of its own**. It
reads market/account data, sends it to the Python bridge, executes
exactly what the bridge approves, and reports closed-trade results back
for learning. Every trading decision (whether to trade, direction,
confidence, sizing, stop loss/take profit) comes from the bridge, which
itself defers to `ai_brain`.

> **This environment has no MetaEditor/MT5 terminal**, so this EA and
> its Include modules were written against documented MQL5 API
> signatures and reviewed carefully, but **could not be compiled or run
> here**. Compile in MetaEditor and test on a demo account before
> running live — this is a hard requirement, not a formality.

## Installation

1. Copy `mt5_ea/Include/*.mqh` into your terminal's
   `MQL5/Include/` folder (or a subfolder — just make sure the
   `#include <JsonUtils.mqh>` style paths in the main EA still resolve;
   if you nest them, update the `#include` lines accordingly).
2. Copy `mt5_ea/MMXM_AI_Brain_EA.mq5` into `MQL5/Experts/`.
3. Open it in MetaEditor and compile (F7). Fix any compiler messages —
   again, this hasn't been compiled in this environment.
4. In the MT5 terminal: **Tools -> Options -> Expert Advisors -> Allow
   WebRequest for listed URL**, and add your bridge's base URL (default
   `http://127.0.0.1:8000`). Without this, every bridge call fails with
   `WebRequest failed, error 4060`.
5. Start the bridge (`python -m bridge.main` from the repo root — see
   `bridge/README.md`) before attaching the EA, or the EA will just log
   "Bridge not reachable yet" at `OnInit` and keep retrying on each
   timer tick.
6. Attach the EA to a chart. Load `config/EA_default.set` in the
   Inputs tab for sane defaults, or set inputs manually (see below).

## Running one EA per symbol

This EA is designed to run **one instance per chart/symbol**, each with
its own `InpMagicNumber` (so their positions/history don't cross-count
each other's max-open-positions or MFE/MAE tracking), all pointing at
the **same bridge instance** — `ai_brain` already handles multiple
symbols internally via the `symbol` field on every trade record.

## Input parameters

| Input | Default | Meaning |
|---|---|---|
| `InpBridgeUrl` | `http://127.0.0.1:8000` | Bridge base URL |
| `InpApiKey` | `""` | Sent as `X-API-Key` header; must match `security.api_key` in `bridge_config.yaml` if that's set (leave both blank for a localhost-only bridge) |
| `InpHttpTimeoutMs` | 5000 | WebRequest timeout (ms) |
| `InpDecisionIntervalSec` | 60 | `OnTimer` cadence for `/predict` requests |
| `InpBarCount` | 100 | OHLC bars sent per request |
| `InpMagicNumber` | 20260101 | Identifies this EA instance's own trades |
| `InpSlippagePoints` | 20 | Max slippage passed to `CTrade` |
| `InpMaxSpreadPointsGuard` | 30.0 | Final local spread re-check before executing |
| `InpMaxOpenPositionsGuard` | 3 | Final local max-open-positions re-check before executing |

The bridge has its own, authoritative copies of the spread/max-position
gates in `config/bridge_config.yaml` — the EA's guards above are a
**second, defense-in-depth check** for conditions that may have shifted
in the time between the request and the response, not the source of
truth.

## Known limitations / caveats

- **Not compiled in this environment.** Verify compilation and runtime
  behavior in MetaEditor/MT5 yourself before live use.
- **Server time vs. UTC**: MT5 bar/deal timestamps are in the broker's
  server time, which may not be true UTC. The EA labels timestamps with
  a `Z` suffix for JSON/ISO-8601 shape, but confirm your broker's
  server-time offset if precise session/hour alignment with `ai_brain`'s
  training data matters to you.
- **SL/TP after an EA restart mid-trade**: the EA caches each position's
  entry price/SL/TP/lot the first tick after it opens, so `/trade_result`
  can report them accurately even after the position itself has closed
  and vanished from MT5's live position list. If the EA is restarted
  while a position is open, that cache is lost; the close report falls
  back to reconstructing entry price/lot/direction from trade history,
  but stop_loss/take_profit will report as `0.0` ("unknown") in that
  specific edge case — documented, not silently swallowed.
- **No structure detection here by design**: BOS/CHOCH/order block/FVG/
  liquidity sweep are computed by the bridge (`bridge/smc_features.py`),
  not this EA — see the architecture note in `bridge/README.md` for why.

## Include module map

| Module | Responsibility |
|---|---|
| `JsonUtils.mqh` | Minimal JSON builder (requests) + flat-schema reader (responses) |
| `HttpClient.mqh` | `WebRequest()` wrapper: encoding, timeout, HTTP status handling |
| `MarketDataCollector.mqh` | OHLC window, ATR, spread, volume, point value |
| `AccountCollector.mqh` | Balance/equity/margin, open positions, open-risk % |
| `TradeExecutor.mqh` | The only module that calls a trade function (`CTrade`) |
| `EaLogger.mqh` | Daily rotating log file + terminal `Print()` mirror |
