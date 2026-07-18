//+------------------------------------------------------------------+
//|                                        MMXM_AI_Brain_EA.mq5      |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| Contains NO trading logic. Every decision (whether to trade,
//| direction, confidence, sizing, SL/TP) comes from the Python bridge
//| (which itself defers to ai_brain). This EA is only responsible for:
//|   - reading market/account data and packaging it into JSON
//|   - sending it to the bridge and receiving a decision
//|   - executing exactly what was approved (TradeExecutor.mqh is the
//|     only place that calls a trade function)
//|   - reporting closed-trade results back for learning
//|
//| Requires the bridge's base URL to be whitelisted under Tools ->
//| Options -> Expert Advisors -> "Allow WebRequest for listed URL" (see
//| mt5_ea/README.md). This file, and the .mqh includes it uses, were
//| written against documented MQL5 API signatures and reviewed
//| carefully, but could not be compiled in this environment (no
//| MetaEditor/MT5 terminal available) — compile and test in MetaEditor
//| before running on a live or demo account.
//+------------------------------------------------------------------+
#property copyright "MMXM"
#property link      ""
#property version   "1.00"
#property strict

#include <JsonUtils.mqh>
#include <HttpClient.mqh>
#include <MarketDataCollector.mqh>
#include <AccountCollector.mqh>
#include <TradeExecutor.mqh>
#include <EaLogger.mqh>

//--- Inputs: everything configurable, nothing hardcoded.
input string InpBridgeUrl             = "http://127.0.0.1:8000"; // Bridge base URL
input int    InpHttpTimeoutMs         = 5000;                    // WebRequest timeout (ms)
input int    InpDecisionIntervalSec   = 60;                      // Seconds between AI decision requests (OnTimer cadence)
input int    InpBarCount              = 100;                     // OHLC bars to send per /predict request
input long   InpMagicNumber           = 20260101;                 // Magic number identifying this EA's trades
input int    InpSlippagePoints        = 20;                       // Max allowed slippage (points)
input double InpMaxSpreadPointsGuard  = 30.0;                     // Final local spread guard, re-checked right before execution
input int    InpMaxOpenPositionsGuard = 3;                        // Final local max-open-positions guard

//--- Globals
int      g_atr_handle             = INVALID_HANDLE;
datetime g_last_decision_bar_time = 0;

//--- Per-open-position tracking (parallel arrays — MQL5 has no map/dict
//    container in the standard language, and position counts here are
//    small enough that linear search is perfectly fine).
ulong    g_tracked_tickets[];
double   g_tracked_mfe[];
double   g_tracked_mae[];
double   g_tracked_entry_price[];
double   g_tracked_sl[];
double   g_tracked_tp[];
double   g_tracked_lot[];
datetime g_tracked_entry_time[];
string   g_tracked_direction[];
string   g_tracked_symbol[];

//+------------------------------------------------------------------+
int OnInit()
  {
   g_atr_handle = InitAtrHandle(_Symbol, _Period, 14);
   if(g_atr_handle == INVALID_HANDLE)
     {
      EaLogError("OnInit", "Failed to create ATR indicator handle.");
      return(INIT_FAILED);
     }

   TradeExecutorInit(InpMagicNumber, InpSlippagePoints);
   EventSetTimer(InpDecisionIntervalSec);

   HttpResult health = HttpGet(InpBridgeUrl + "/health", InpHttpTimeoutMs);
   if(health.success)
      EaLog("INIT", "Bridge reachable: " + health.body);
   else
      EaLog("INIT", "Bridge not reachable yet (" + health.error + "). Will keep retrying on each timer tick.");

   EaLog("INIT", StringFormat(
      "MMXM AI Brain EA initialized for %s %s, magic=%d",
      _Symbol, TimeframeToString(_Period), InpMagicNumber));

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   ReleaseAtrHandle(g_atr_handle);
   EaLog("DEINIT", "MMXM AI Brain EA stopped, reason=" + IntegerToString(reason));
   EaLogClose();
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   UpdateMfeMae();
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   RequestDecisionIfDue();
  }

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong deal_ticket = trans.deal;
   if(!HistoryDealSelect(deal_ticket))
      return;

   long entry_type = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
   if(entry_type != DEAL_ENTRY_OUT && entry_type != DEAL_ENTRY_OUT_BY)
      return; // only closing deals are reported to the bridge

   long magic = HistoryDealGetInteger(deal_ticket, DEAL_MAGIC);
   if(magic != InpMagicNumber)
      return;

   ReportTradeClose(deal_ticket);
  }

//+------------------------------------------------------------------+
//| Helpers                                                           |
//+------------------------------------------------------------------+

string TimeframeToString(const ENUM_TIMEFRAMES tf)
  {
   string s = EnumToString(tf);
   StringReplace(s, "PERIOD_", "");
   return s;
  }

string GenerateRequestId()
  {
   return StringFormat("%s-%d-%d", _Symbol, (long)TimeCurrent(), MathRand());
  }

//--- Only ask for a new decision once per new bar, and only when this
//    EA doesn't already have an open position on this symbol — avoids
//    stacking multiple trades on the same setup. This is orchestration
//    cadence, not a trading decision.
void RequestDecisionIfDue()
  {
   datetime current_bar_time = iTime(_Symbol, _Period, 0);
   if(current_bar_time == g_last_decision_bar_time)
      return;
   g_last_decision_bar_time = current_bar_time;

   if(CountOpenPositionsForSymbol(_Symbol, InpMagicNumber) > 0)
      return;

   string request_id = GenerateRequestId();
   string payload = BuildPredictRequestJson(request_id);

   EaLogRequest(request_id, _Symbol, payload);

   HttpResult result = HttpPost(InpBridgeUrl + "/predict", payload, InpHttpTimeoutMs);
   if(!result.success)
     {
      EaLogError("RequestDecisionIfDue", result.error);
      return;
     }

   EaLogResponse(request_id, result.body);
   HandlePredictResponse(request_id, result.body);
  }

string BuildPredictRequestJson(const string request_id)
  {
   string ohlc_json    = CollectOhlcJson(_Symbol, _Period, InpBarCount);
   double atr          = ReadAtr(g_atr_handle);
   double spread       = CollectSpreadPoints(_Symbol);
   double point_value  = CollectPointValue(_Symbol);

   string account_json = JsonObject(
      JsonFieldNum("balance", CollectBalance(), 2) + "," +
      JsonFieldNum("equity", CollectEquity(), 2) + "," +
      JsonFieldNum("free_margin", CollectFreeMargin(), 2) + "," +
      JsonFieldNum("margin_level", CollectMarginLevel(), 2) + "," +
      JsonFieldInt("open_positions", CountOpenPositions(InpMagicNumber)) + "," +
      JsonFieldNum("open_risk_percent", CollectOpenRiskPercent(InpMagicNumber), 2)
     );

   string positions_json = CollectExistingPositionsJson(InpMagicNumber);

   string fields =
      JsonFieldStr("request_id", request_id) + "," +
      JsonFieldStr("timestamp", FormatIsoTime(TimeCurrent())) + "," +
      JsonFieldStr("symbol", _Symbol) + "," +
      JsonFieldStr("timeframe", TimeframeToString(_Period)) + "," +
      "\"ohlc\":" + ohlc_json + "," +
      JsonFieldNum("spread", spread, 1) + "," +
      JsonFieldNum("atr", atr, _Digits) + "," +
      "\"account\":" + account_json + "," +
      "\"existing_positions\":" + positions_json + "," +
      JsonFieldNum("point_value", point_value, 6);

   return JsonObject(fields);
  }

void HandlePredictResponse(const string request_id, const string body)
  {
   string action          = JsonGetString(body, "action", "HOLD");
   string rejected_reason = JsonGetString(body, "rejected_reason", "");

   if(action == "HOLD")
     {
      if(rejected_reason != "")
         EaLogRejected(request_id, rejected_reason);
      return;
     }

   double lot_size    = JsonGetDouble(body, "lot_size", 0.0);
   double stop_loss   = JsonGetDouble(body, "stop_loss", 0.0);
   double take_profit = JsonGetDouble(body, "take_profit", 0.0);

   if(lot_size <= 0.0)
     {
      EaLogError("HandlePredictResponse",
                 "Bridge approved " + action + " but lot_size is invalid: " + DoubleToString(lot_size, 2));
      return;
     }

   //--- Final local guards (defense in depth): conditions can shift in
   //    the time between the /predict request and this response.
   if(CollectSpreadPoints(_Symbol) > InpMaxSpreadPointsGuard)
     {
      EaLogRejected(request_id, "local_guard_spread_too_wide");
      return;
     }
   if(CountOpenPositionsForSymbol(_Symbol, InpMagicNumber) >= InpMaxOpenPositionsGuard)
     {
      EaLogRejected(request_id, "local_guard_max_positions");
      return;
     }

   string error;
   bool ok = ExecuteApprovedTrade(_Symbol, action, lot_size, stop_loss, take_profit, error);
   if(ok)
      EaLogExecution(request_id, action, lot_size, stop_loss, take_profit);
   else
      EaLogError("ExecuteApprovedTrade", error);
  }

//+------------------------------------------------------------------+
//| MFE/MAE tracking (money terms — running max/min POSITION_PROFIT   |
//| observed while a position owned by this EA is open)               |
//+------------------------------------------------------------------+

int FindTrackedIndex(const ulong ticket)
  {
   for(int i = 0; i < ArraySize(g_tracked_tickets); i++)
      if(g_tracked_tickets[i] == ticket)
         return i;
   return -1;
  }

void UpdateMfeMae()
  {
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber)
         continue;

      double profit = PositionGetDouble(POSITION_PROFIT);
      int idx = FindTrackedIndex(ticket);

      if(idx < 0)
        {
         int new_size = ArraySize(g_tracked_tickets) + 1;
         ArrayResize(g_tracked_tickets, new_size);
         ArrayResize(g_tracked_mfe, new_size);
         ArrayResize(g_tracked_mae, new_size);
         ArrayResize(g_tracked_entry_price, new_size);
         ArrayResize(g_tracked_sl, new_size);
         ArrayResize(g_tracked_tp, new_size);
         ArrayResize(g_tracked_lot, new_size);
         ArrayResize(g_tracked_entry_time, new_size);
         ArrayResize(g_tracked_direction, new_size);
         ArrayResize(g_tracked_symbol, new_size);

         idx = new_size - 1;
         g_tracked_tickets[idx]     = ticket;
         g_tracked_mfe[idx]         = profit;
         g_tracked_mae[idx]         = profit;
         g_tracked_entry_price[idx] = PositionGetDouble(POSITION_PRICE_OPEN);
         g_tracked_sl[idx]          = PositionGetDouble(POSITION_SL);
         g_tracked_tp[idx]          = PositionGetDouble(POSITION_TP);
         g_tracked_lot[idx]         = PositionGetDouble(POSITION_VOLUME);
         g_tracked_entry_time[idx]  = (datetime)PositionGetInteger(POSITION_TIME);
         g_tracked_direction[idx]   = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "buy" : "sell";
         g_tracked_symbol[idx]      = PositionGetString(POSITION_SYMBOL);
        }
      else
        {
         if(profit > g_tracked_mfe[idx])
            g_tracked_mfe[idx] = profit;
         if(profit < g_tracked_mae[idx])
            g_tracked_mae[idx] = profit;
        }
     }
  }

void RemoveTrackedPosition(const ulong ticket)
  {
   int idx = FindTrackedIndex(ticket);
   if(idx < 0)
      return;

   int last = ArraySize(g_tracked_tickets) - 1;
   g_tracked_tickets[idx]     = g_tracked_tickets[last];
   g_tracked_mfe[idx]         = g_tracked_mfe[last];
   g_tracked_mae[idx]         = g_tracked_mae[last];
   g_tracked_entry_price[idx] = g_tracked_entry_price[last];
   g_tracked_sl[idx]          = g_tracked_sl[last];
   g_tracked_tp[idx]          = g_tracked_tp[last];
   g_tracked_lot[idx]         = g_tracked_lot[last];
   g_tracked_entry_time[idx]  = g_tracked_entry_time[last];
   g_tracked_direction[idx]   = g_tracked_direction[last];
   g_tracked_symbol[idx]      = g_tracked_symbol[last];

   ArrayResize(g_tracked_tickets, last);
   ArrayResize(g_tracked_mfe, last);
   ArrayResize(g_tracked_mae, last);
   ArrayResize(g_tracked_entry_price, last);
   ArrayResize(g_tracked_sl, last);
   ArrayResize(g_tracked_tp, last);
   ArrayResize(g_tracked_lot, last);
   ArrayResize(g_tracked_entry_time, last);
   ArrayResize(g_tracked_direction, last);
   ArrayResize(g_tracked_symbol, last);
  }

//+------------------------------------------------------------------+
//| Trade close reporting                                             |
//+------------------------------------------------------------------+

string DetermineExitReason(const ulong deal_ticket)
  {
   long reason = HistoryDealGetInteger(deal_ticket, DEAL_REASON);
   switch(reason)
     {
      case DEAL_REASON_SL:     return "sl";
      case DEAL_REASON_TP:     return "tp";
      case DEAL_REASON_SO:     return "stop_out";
      case DEAL_REASON_CLIENT: return "manual";
      case DEAL_REASON_MOBILE: return "manual";
      case DEAL_REASON_WEB:    return "manual";
      case DEAL_REASON_EXPERT: return "expert";
      default:                 return "unknown";
     }
  }

//--- Best-effort fallback for entry details when the position wasn't
//    seen by UpdateMfeMae (e.g. the EA was restarted mid-trade). SL/TP
//    aren't recoverable this way once the position is fully closed —
//    they'll read as 0.0 ("unknown") in that edge case, which the
//    bridge/ai_brain side tolerates rather than failing the feedback
//    loop entirely.
void FindPositionOpenDetailsFallback(
   const ulong position_id,
   double &entry_price,
   double &lot_size,
   datetime &entry_time,
   string &direction)
  {
   entry_price = 0.0;
   lot_size    = 0.0;
   entry_time  = 0;
   direction   = "buy";

   if(!HistorySelectByPosition(position_id))
      return;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal_ticket = HistoryDealGetTicket(i);
      if(deal_ticket == 0)
         continue;
      if(HistoryDealGetInteger(deal_ticket, DEAL_ENTRY) != DEAL_ENTRY_IN)
         continue;

      entry_price = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
      lot_size    = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
      entry_time  = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
      direction   = (HistoryDealGetInteger(deal_ticket, DEAL_TYPE) == DEAL_TYPE_BUY) ? "buy" : "sell";
      break;
     }
  }

void ReportTradeClose(const ulong deal_ticket)
  {
   ulong position_id = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);

   string symbol       = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   double exit_price   = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double deal_profit  = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double deal_swap     = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   double deal_commission = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double total_pnl    = deal_profit + deal_swap + deal_commission;
   datetime exit_time  = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);

   double entry_price, lot_size, stop_loss, take_profit, mfe, mae;
   datetime entry_time;
   string direction;

   int idx = FindTrackedIndex(position_id);
   if(idx >= 0)
     {
      entry_price = g_tracked_entry_price[idx];
      lot_size    = g_tracked_lot[idx];
      stop_loss   = g_tracked_sl[idx];
      take_profit = g_tracked_tp[idx];
      entry_time  = g_tracked_entry_time[idx];
      direction   = g_tracked_direction[idx];
      mfe         = g_tracked_mfe[idx];
      mae         = g_tracked_mae[idx];
     }
   else
     {
      FindPositionOpenDetailsFallback(position_id, entry_price, lot_size, entry_time, direction);
      stop_loss   = 0.0;
      take_profit = 0.0;
      mfe         = total_pnl;
      mae         = total_pnl;
     }

   double duration_seconds = (double)(exit_time - entry_time);
   string outcome = (total_pnl > 0.0) ? "win" : (total_pnl < 0.0 ? "loss" : "breakeven");
   string exit_reason = DetermineExitReason(deal_ticket);
   double atr = ReadAtr(g_atr_handle);
   double spread = CollectSpreadPoints(symbol);
   double volume = CollectLatestVolume(symbol, _Period);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   string trade_id = IntegerToString((long)position_id);

   string fields =
      JsonFieldStr("trade_id", trade_id) + "," +
      JsonFieldStr("symbol", symbol) + "," +
      JsonFieldStr("timeframe", TimeframeToString(_Period)) + "," +
      JsonFieldStr("direction", direction) + "," +
      JsonFieldStr("entry_time", FormatIsoTime(entry_time)) + "," +
      JsonFieldStr("exit_time", FormatIsoTime(exit_time)) + "," +
      JsonFieldNum("entry_price", entry_price, digits) + "," +
      JsonFieldNum("exit_price", exit_price, digits) + "," +
      JsonFieldNum("stop_loss", stop_loss, digits) + "," +
      JsonFieldNum("take_profit", take_profit, digits) + "," +
      JsonFieldNum("lot_size", lot_size, 2) + "," +
      JsonFieldNum("atr", atr, digits) + "," +
      JsonFieldNum("spread", spread, 1) + "," +
      JsonFieldNum("volume", volume, 0) + "," +
      JsonFieldNum("pnl", total_pnl, 2) + "," +
      JsonFieldStr("outcome", outcome) + "," +
      JsonFieldStr("exit_reason", exit_reason) + "," +
      JsonFieldNum("duration_seconds", duration_seconds, 0) + "," +
      JsonFieldNum("max_favorable_excursion", mfe, 2) + "," +
      JsonFieldNum("max_adverse_excursion", mae, 2) + "," +
      JsonFieldNum("drawdown", MathAbs(mae), 2);

   string payload = JsonObject(fields);

   EaLogTradeResult(trade_id, outcome, total_pnl);

   HttpResult result = HttpPost(InpBridgeUrl + "/trade_result", payload, InpHttpTimeoutMs);
   if(!result.success)
      EaLogError("ReportTradeClose", result.error);

   RemoveTrackedPosition(position_id);
  }
