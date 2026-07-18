//+------------------------------------------------------------------+
//|                                            TradeExecutor.mqh     |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| The ONLY module that places orders. It executes EXACTLY what the
//| bridge approved (direction, lot size, stop loss, take profit) — it
//| never computes a direction, never decides whether to trade, and
//| never adjusts the lot size upward. That judgment is 100% the
//| bridge's (and ai_brain's) job.
//|
//| Callers are expected to have already re-validated spread/session/
//| max-open-positions locally right before calling this (defense in
//| depth — conditions can shift in the time between the /predict
//| request and this call).
//+------------------------------------------------------------------+
#ifndef MMXM_TRADE_EXECUTOR_MQH
#define MMXM_TRADE_EXECUTOR_MQH
#include <Trade\Trade.mqh>

CTrade g_mmxm_trade;

void TradeExecutorInit(const long magic_number, const int slippage_points)
  {
   g_mmxm_trade.SetExpertMagicNumber(magic_number);
   g_mmxm_trade.SetDeviationInPoints(slippage_points);
   g_mmxm_trade.SetTypeFillingBySymbol(_Symbol);
  }

//--- Executes exactly the action/lot/SL/TP the bridge returned. Returns
//    false and fills error_out on failure; never retries or modifies
//    the requested parameters itself. ``position_id_out`` is set to the
//    MT5 position ticket this execution created (0 if it couldn't be
//    determined) — the caller needs this to correlate the trade back to
//    the original /predict request_id (see MMXM_AI_Brain_EA.mq5's
//    RememberRequestId/RecallRequestId).
bool ExecuteApprovedTrade(
   const string symbol,
   const string action,
   const double lot_size,
   const double stop_loss,
   const double take_profit,
   string &error_out,
   ulong &position_id_out)
  {
   error_out = "";
   position_id_out = 0;

   if(action != "BUY" && action != "SELL")
     {
      error_out = "ExecuteApprovedTrade called with an action other than BUY/SELL: " + action;
      return false;
     }

   if(lot_size <= 0.0)
     {
      error_out = "ExecuteApprovedTrade called with a non-positive lot size.";
      return false;
     }

   //--- Sanity-check SL/TP orientation against the current market price
   //    before ever calling Buy/Sell. Under normal operation
   //    translator.py always computes these correctly (tested there),
   //    and the broker would likely reject an inverted stop anyway —
   //    but this is a cheap, independent safety net catching a bad
   //    bridge response (or a JSON-parsing glitch on this side) with a
   //    clear log message instead of relying solely on a generic
   //    broker retcode. A stop_loss/take_profit of exactly 0.0 means
   //    "not set" and is left unchecked.
   double reference_price = (action == "BUY")
      ? SymbolInfoDouble(symbol, SYMBOL_ASK)
      : SymbolInfoDouble(symbol, SYMBOL_BID);

   if(reference_price <= 0.0)
     {
      error_out = "ExecuteApprovedTrade could not read a valid market price for " + symbol + ".";
      return false;
     }

   if(action == "BUY")
     {
      if(stop_loss > 0.0 && stop_loss >= reference_price)
        {
         error_out = StringFormat(
            "Rejected: BUY stop_loss %.5f is not below the current ask %.5f.", stop_loss, reference_price);
         return false;
        }
      if(take_profit > 0.0 && take_profit <= reference_price)
        {
         error_out = StringFormat(
            "Rejected: BUY take_profit %.5f is not above the current ask %.5f.", take_profit, reference_price);
         return false;
        }
     }
   else // SELL
     {
      if(stop_loss > 0.0 && stop_loss <= reference_price)
        {
         error_out = StringFormat(
            "Rejected: SELL stop_loss %.5f is not above the current bid %.5f.", stop_loss, reference_price);
         return false;
        }
      if(take_profit > 0.0 && take_profit >= reference_price)
        {
         error_out = StringFormat(
            "Rejected: SELL take_profit %.5f is not below the current bid %.5f.", take_profit, reference_price);
         return false;
        }
     }

   bool ok;
   if(action == "BUY")
      ok = g_mmxm_trade.Buy(lot_size, symbol, 0.0, stop_loss, take_profit, "MMXM AI Brain");
   else
      ok = g_mmxm_trade.Sell(lot_size, symbol, 0.0, stop_loss, take_profit, "MMXM AI Brain");

   if(!ok)
     {
      error_out = StringFormat(
         "Trade execution failed: retcode=%d (%s)",
         g_mmxm_trade.ResultRetcode(), g_mmxm_trade.ResultRetcodeDescription());
      return false;
     }

   //--- Resolve the position this execution created via its opening
   //    deal, so the caller can remember which /predict request_id led
   //    to which position.
   ulong deal_ticket = g_mmxm_trade.ResultDeal();
   if(deal_ticket != 0 && HistoryDealSelect(deal_ticket))
      position_id_out = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);

   return true;
  }

#endif // MMXM_TRADE_EXECUTOR_MQH
