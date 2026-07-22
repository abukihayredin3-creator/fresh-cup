# MMXM AI Brain EA — MetaEditor Compilation Checklist

This package (`mt5_ea/MMXM_AI_Brain_EA.mq5` + `mt5_ea/Include/*.mqh`) has been
prepared for compilation but **has not been compiled** — this environment has
no MetaEditor/MT5 terminal. Everything below was verified by careful manual
review against documented MQL5 API signatures (current, non-deprecated APIs
throughout) and by fixing every warning-shaped pattern I could find. Treat
this as a strong starting point, not a guarantee — F7 in MetaEditor is the
actual source of truth.

## What changed in this pass

All changes below are compile-hardening only — no behavior change, no new
features, `ai_brain/` untouched.

1. **Uninitialized locals eliminated everywhere.** Every local variable that
   was previously declared without an initializer and only assigned inside
   conditional branches now has an explicit default at declaration:
   `JsonUtils.mqh` (`endPos`, four `found` locals), `MarketDataCollector.mqh`
   (`spread_points`), `TradeExecutor.mqh` (`ok`), and
   `MMXM_AI_Brain_EA.mq5`'s `ReportTradeClose` (`entry_price`, `lot_size`,
   `stop_loss`, `take_profit`, `mfe`, `mae`, `entry_time`, `direction`).
2. **JSON unescape correctness fixed.** `JsonGetString` previously reversed
   escaping via three sequential `StringReplace` calls, which can corrupt a
   value containing a literal backslash immediately followed by a literal
   `n`/`r`/`t` character (the second replace pass can't tell a "real" `\n`
   apart from an escaped-backslash-then-`n`). Replaced with a single
   left-to-right scanning `JsonUnescape` function that has no such hazard.
   Not currently reachable by any value the EA actually parses (`action`,
   `rejected_reason` are a small fixed ASCII vocabulary), but fixed since
   this pass explicitly asked to verify JSON serialization.
3. **Explicit `(ulong)` casts added** at `CTrade::SetExpertMagicNumber`/
   `SetDeviationInPoints` call sites in `TradeExecutor.mqh` — both take
   `ulong`; the EA's own `magic_number`/`slippage_points` parameters are
   `long`/`int` to match its `input` declarations. The cast removes any
   signed/unsigned conversion warning regardless of exact overload
   resolution.
4. **`StringFormat("%d", ...)` with a `long` argument removed** in
   `GenerateRequestId()` and the `OnInit()` log line (both used
   `InpMagicNumber`/`TimeCurrent()`, both `long`/`datetime`). `%d`
   historically denotes a 32-bit `int` in printf-style specifiers; while
   MQL5's `StringFormat` is generally type-aware and this likely already
   worked, both call sites were rewritten as plain concatenation with
   `IntegerToString` (whose parameter is explicitly `long`) to remove any
   doubt rather than rely on it.

## 1. Every `.mq5`/`.mqh` file reviewed

| File | Role | Status |
|---|---|---|
| `MMXM_AI_Brain_EA.mq5` | Main EA | Reviewed, hardened |
| `Include/JsonUtils.mqh` | JSON build/parse | Reviewed, hardened |
| `Include/HttpClient.mqh` | `WebRequest` wrapper | Reviewed, clean |
| `Include/MarketDataCollector.mqh` | OHLC/ATR/spread/volume | Reviewed, hardened |
| `Include/AccountCollector.mqh` | Account/position data | Reviewed, clean |
| `Include/TradeExecutor.mqh` | Order placement | Reviewed, hardened |
| `Include/EaLogger.mqh` | File logging | Reviewed, clean |

## 2. Compile-warning sources eliminated

- [x] No local variable is declared without an initializer anywhere in the
  package (grep for a bare `type name;` declaration followed by
  conditional-only assignment — none remain).
- [x] No narrowing numeric conversion is left implicit — every `long`→`int`,
  `long`→`ulong`, and `long`→`datetime` conversion has an explicit cast
  (`(int)`, `(ulong)`, `(datetime)`).
- [x] No `%d` format specifier is used with a `long`/`datetime` argument
  through `StringFormat`/`PrintFormat` (the two spots that did this were
  rewritten with `IntegerToString`, whose signature is unambiguously
  `long`).
- [x] `int`↔`int` and `ulong`↔`ulong` comparisons only — no signed/unsigned
  literal-vs-variable mismatches found (`ticket == 0`, `deal_ticket != 0`
  etc. compare an unsigned variable against the literal `0`, which is not a
  sign-mismatch case).

## 3. Every `#include` verified

- `MMXM_AI_Brain_EA.mq5` includes all six `.mqh` files by `<AngleBracket>`
  path, which resolves against the terminal's `MQL5/Include/` root — **all
  six `.mqh` files must be copied directly into `MQL5/Include/`** (not a
  subfolder) for these paths to resolve as written.
- `MarketDataCollector.mqh` and `AccountCollector.mqh` each additionally
  `#include <JsonUtils.mqh>` (needed for the `JsonField*`/`JsonObject`/
  `JsonArray` helpers they call). This means `JsonUtils.mqh` is textually
  included three times total across the compiled unit — safe, because every
  `.mqh` has a unique `#ifndef MMXM_..._MQH` include guard, so the
  preprocessor only emits each declaration once.
- `TradeExecutor.mqh` includes `<Trade\Trade.mqh>` — the standard MQL5
  library path for `CTrade`, present in every stock MetaTrader 5
  installation; no extra setup needed.
- No circular includes, no missing includes, no duplicate-symbol risk
  (verified — see §7 for the full symbol-name audit).

## 4. Every enum verified

All enum constants are paired with the correct getter-function family:

| Enum | Constants used | Paired with |
|---|---|---|
| `ENUM_TIMEFRAMES` | `_Period` (implicit) | `iATR`, `CopyRates`, `CopyTickVolume` |
| `ENUM_SYMBOL_INFO_INTEGER` | `SYMBOL_DIGITS`, `SYMBOL_SPREAD` | `SymbolInfoInteger` |
| `ENUM_SYMBOL_INFO_DOUBLE` | `SYMBOL_TRADE_TICK_VALUE`, `SYMBOL_TRADE_TICK_SIZE`, `SYMBOL_POINT`, `SYMBOL_ASK`, `SYMBOL_BID` | `SymbolInfoDouble` |
| `ENUM_ACCOUNT_INFO_DOUBLE` | `ACCOUNT_BALANCE`, `ACCOUNT_EQUITY`, `ACCOUNT_MARGIN_FREE`, `ACCOUNT_MARGIN_LEVEL` | `AccountInfoDouble` |
| `ENUM_POSITION_PROPERTY_INTEGER` | `POSITION_MAGIC`, `POSITION_TYPE`, `POSITION_TIME` | `PositionGetInteger` |
| `ENUM_POSITION_PROPERTY_DOUBLE` | `POSITION_SL`, `POSITION_TP`, `POSITION_PRICE_OPEN`, `POSITION_VOLUME`, `POSITION_PROFIT` | `PositionGetDouble` |
| `ENUM_POSITION_PROPERTY_STRING` | `POSITION_SYMBOL` | `PositionGetString` |
| `ENUM_POSITION_TYPE` | `POSITION_TYPE_BUY` | compared against `PositionGetInteger(POSITION_TYPE)` |
| `ENUM_DEAL_PROPERTY_INTEGER` | `DEAL_ENTRY`, `DEAL_MAGIC`, `DEAL_POSITION_ID`, `DEAL_TIME`, `DEAL_TYPE`, `DEAL_REASON` | `HistoryDealGetInteger` |
| `ENUM_DEAL_PROPERTY_DOUBLE` | `DEAL_PRICE`, `DEAL_PROFIT`, `DEAL_SWAP`, `DEAL_COMMISSION`, `DEAL_VOLUME` | `HistoryDealGetDouble` |
| `ENUM_DEAL_PROPERTY_STRING` | `DEAL_SYMBOL` | `HistoryDealGetString` |
| `ENUM_DEAL_ENTRY` | `DEAL_ENTRY_IN`, `DEAL_ENTRY_OUT`, `DEAL_ENTRY_OUT_BY` | — |
| `ENUM_DEAL_TYPE` | `DEAL_TYPE_BUY` | — |
| `ENUM_DEAL_REASON` | `DEAL_REASON_SL/TP/SO/CLIENT/MOBILE/WEB/EXPERT` + `default` | `switch` in `DetermineExitReason` — every case returns, so no fallthrough; `default` covers the remaining members (`ROLLOVER`, `VMARGIN`, `SPLIT`) not explicitly named |
| `ENUM_TRADE_TRANSACTION_TYPE` | `TRADE_TRANSACTION_DEAL_ADD` | `OnTradeTransaction`'s `trans.type` |
| `ENUM_INIT_RETCODE` | `INIT_SUCCEEDED`, `INIT_FAILED` | `OnInit()` return value |
| `ENUM_FILE_OPEN_FLAGS` | `FILE_READ \| FILE_WRITE \| FILE_TXT \| FILE_ANSI \| FILE_SHARE_READ` | `FileOpen` |

**Known, documented limitation (not a compile issue):** `OnTradeTransaction`
only recognizes `DEAL_ENTRY_OUT`/`DEAL_ENTRY_OUT_BY` as "closing" deals. It
does not special-case `DEAL_ENTRY_INOUT` (a same-tick position reversal,
possible only on netting-type accounts when an opposing order is large
enough to flip the position instead of just closing it). Since this EA only
ever opens a new position while flat (`RequestDecisionIfDue` checks
`CountOpenPositionsForSymbol(...) > 0` first) and never itself submits an
opposing order, this case can only arise from manual intervention or another
EA/account activity on a netting account — flagged for awareness, left
as-is since fixing it would mean splitting PnL attribution across two deals,
a logic change beyond this compile-readiness pass's scope.

## 5. Every MQL5 API call verified

Spot-checked against documented signatures: `iATR`, `CopyBuffer`,
`IndicatorRelease`, `CopyRates`, `CopyTickVolume`, `SymbolInfoInteger` (both
the 2-arg direct-return and 3-arg out-param overloads, used correctly and
distinctly), `SymbolInfoDouble`, `AccountInfoDouble`, `PositionsTotal`,
`PositionGetTicket`, `PositionGetInteger/Double/String`, `HistorySelectByPosition`,
`HistoryDealsTotal`, `HistoryDealGetTicket`, `HistoryDealSelect`,
`HistoryDealGetInteger/Double/String`, `EventSetTimer`/`EventKillTimer`,
`FileOpen`/`FileClose`/`FileWriteString`/`FileSeek`/`FileFlush`,
`StringToCharArray`/`CharArrayToString`, `MathRand`/`MathAbs`,
`TimeCurrent`/`TimeToString`/`iTime`, `StringFind`/`StringGetCharacter`/
`StringSubstr`/`StringReplace`/`StringLen`, `IntegerToString`/
`DoubleToString`/`StringToDouble`, `GetLastError`/`ResetLastError`. None are
deprecated in current MQL5 builds; all use the modern position/history API
(never the legacy MQL4-style `OrderSelect`/`OrderSend`).

**Residual uncertainty, flagged rather than hidden:** `WebRequest`'s
`data`/`result` array parameters are declared `uchar` throughout this code
(`uchar request_data[]`, `uchar response_data[]`). This matches current
MetaQuotes documentation and modern example code as best I can recall, but
since it can't be compiled here, **this is the single highest-value thing to
confirm first in MetaEditor** — if the installed build's `WebRequest`
signature expects `char` instead of `uchar`, every array declared for it in
`HttpClient.mqh` would need that one-word change.

## 6. Every `CTrade` usage verified

- `SetExpertMagicNumber((ulong)magic_number)`, `SetDeviationInPoints((ulong)slippage_points)`,
  `SetTypeFillingBySymbol(_Symbol)` — called once in `TradeExecutorInit`,
  from `OnInit()`.
- `Buy(volume, symbol, price, sl, tp, comment)` / `Sell(...)` — same
  6-argument signature, `price=0.0` (current-market-price sentinel),
  `symbol` explicit (never relies on `NULL`/current-chart default).
- `ResultRetcode()`, `ResultRetcodeDescription()`, `ResultDeal()` — read
  immediately after a `Buy`/`Sell` call, never cached or read stale.
- `TradeExecutor.mqh` remains the **only** file that references `CTrade` or
  calls a trade-placing method — confirmed by grep across the whole
  package.

## 7. Every `WebRequest` usage verified

- Exactly two call sites, both in `HttpClient.mqh` (`HttpPost`, `HttpGet`),
  both using the same 7-parameter signature (`method, url, headers, timeout,
  data[], result[], result_headers`).
- `ResetLastError()` called immediately before every `WebRequest`, `GetLastError()`
  read immediately after a `-1` return — correct MQL5 error-retrieval
  pattern (stale/leftover error codes can't leak in).
- Every caller (`RequestDecisionIfDue`, `ReportTradeClose`, `OnInit`'s
  health check) checks `result.success` before touching `result.body` —
  no code path parses a body from a failed request.
- **Action required in MetaTrader, not code:** the bridge's base URL
  (default `http://127.0.0.1:8000`) must be added under Tools → Options →
  Expert Advisors → "Allow WebRequest for listed URL", or every call
  returns status `-1` with `GetLastError() == 4060`. This is a terminal
  setting, not something the code can do for itself.

## 8. JSON serialization verified

- Every outbound object is assembled from `JsonField*`/`JsonObject`/
  `JsonArray` fragments — traced `BuildPredictRequestJson` and
  `ReportTradeClose`'s field lists end-to-end; every fragment is
  comma-joined with no leading/trailing stray comma, and every nested
  object/array (`ohlc`, `account`, `existing_positions`) is embedded via
  the same `"\"key\":" + json` pattern used consistently everywhere.
- Field names and shapes cross-checked directly against
  `bridge/schemas.py` (`PredictRequest`, `AccountInfo`, `ExistingPosition`,
  `TradeResultRequest`) — no drift found.
- Inbound parsing (`JsonGetString`/`JsonGetDouble`) only ever targets the
  known-flat `PredictResponse` shape; unescape logic fixed per item 2
  above.

## 9. `OnInit()`, `OnTick()`, `OnTimer()`, `OnTradeTransaction()` verified

- **Signatures** match the platform's fixed, mandatory shapes exactly:
  `int OnInit()`, `void OnDeinit(const int reason)`, `void OnTick()`,
  `void OnTimer()`, `void OnTradeTransaction(const MqlTradeTransaction&,
  const MqlTradeRequest&, const MqlTradeResult&)`.
- **`OnInit`**: creates the ATR handle (fails init loudly if it can't),
  initializes `CTrade` via `TradeExecutorInit`, starts the timer
  (`EventSetTimer` — required for `OnTimer` to ever fire), does a
  non-fatal `/health` probe.
- **`OnDeinit`**: mirrors `OnInit` — kills the timer, releases the ATR
  handle, closes the log file. Every resource acquired in `OnInit` has a
  matching release here.
- **`OnTick`**: lightweight only (`UpdateMfeMae`) — no HTTP calls, no
  trade decisions.
- **`OnTimer`**: the only place that requests an AI decision
  (`RequestDecisionIfDue`) — requires `EventSetTimer` to have run in
  `OnInit`, confirmed present.
- **`OnTradeTransaction`**: filters to `TRADE_TRANSACTION_DEAL_ADD` +
  closing-entry-type + this EA's own magic number before ever calling
  `ReportTradeClose` — confirmed no other deal types reach it.

## 10. Strict mode compatibility

- `#property strict` present in `MMXM_AI_Brain_EA.mq5` (properties apply to
  the whole compiled unit; `.mqh` files don't declare their own).
- No MQL4-compatibility constructs anywhere (no implicit variable
  declarations, no `OrderSelect`/`OrderSend`-style legacy order API) — this
  was written MQL5-native from the start, not ported.
- Every numeric narrowing conversion is explicit (§2); every local is
  initialized at declaration (§2).

## 11. Current MetaTrader 5 build compatibility

- Every API used is part of the modern, actively-supported MQL5 surface
  (position/history netting-and-hedging-aware functions, `CTrade`,
  `WebRequest`) — nothing from the deprecated/legacy surface.
- The one point of genuine, stated uncertainty is the `WebRequest`
  `char`-vs-`uchar` array type noted in §5 — confirm this first.

## First-compile action plan

1. Copy `Include/*.mqh` → `<Terminal Data Folder>/MQL5/Include/`.
2. Copy `MMXM_AI_Brain_EA.mq5` → `<Terminal Data Folder>/MQL5/Experts/`.
3. Open `MMXM_AI_Brain_EA.mq5` in MetaEditor, press F7.
4. If `WebRequest` reports a data/result array type mismatch, change
   `uchar` → `char` in `HttpClient.mqh`'s two functions (the only place
   those arrays are declared) and recompile.
5. Fix any other compiler messages that surface — none are anticipated
   given the review above, but this file only reduces risk, it doesn't
   guarantee a clean build.
6. Add the bridge's base URL under Tools → Options → Expert Advisors →
   "Allow WebRequest for listed URL" before attaching the EA to a chart.
7. Load `config/EA_default.set` in the Inputs tab, start the bridge
   (`python -m bridge.main`), then attach the EA to a demo account chart
   and confirm the `OnInit` health-check log line shows the bridge as
   reachable.
