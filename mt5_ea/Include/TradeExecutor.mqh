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
//    the requested parameters itself.
bool ExecuteApprovedTrade(
   const string symbol,
   const string action,
   const double lot_size,
   const double stop_loss,
   const double take_profit,
   string &error_out)
  {
   error_out = "";

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

   return true;
  }

#endif // MMXM_TRADE_EXECUTOR_MQH
