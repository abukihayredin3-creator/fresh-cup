//+------------------------------------------------------------------+
//|                                        MarketDataCollector.mqh   |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| Collects raw market data (OHLC, spread, ATR, volume, point value)
//| and serializes the OHLC window into the JSON contract's "ohlc"
//| array. Pure data collection — no interpretation, no signals, no
//| trading logic. Structure detection (BOS/CHOCH/etc.) happens on the
//| bridge, not here.
//|
//| The ATR indicator handle is created once by the caller (EA's
//| OnInit, via InitAtrHandle) and released in OnDeinit — recreating a
//| handle on every read is wasteful and its first read can return
//| stale/empty data before the indicator has warmed up.
//+------------------------------------------------------------------+
#ifndef MMXM_MARKET_DATA_COLLECTOR_MQH
#define MMXM_MARKET_DATA_COLLECTOR_MQH
#include <JsonUtils.mqh>

int InitAtrHandle(const string symbol, const ENUM_TIMEFRAMES timeframe, const int period = 14)
  {
   return iATR(symbol, timeframe, period);
  }

void ReleaseAtrHandle(int &handle)
  {
   if(handle != INVALID_HANDLE)
     {
      IndicatorRelease(handle);
      handle = INVALID_HANDLE;
     }
  }

double ReadAtr(const int atr_handle)
  {
   if(atr_handle == INVALID_HANDLE)
      return 0.0;

   double buffer[];
   ArraySetAsSeries(buffer, true);
   if(CopyBuffer(atr_handle, 0, 0, 1, buffer) <= 0)
      return 0.0;

   return buffer[0];
  }

//--- Chronological (oldest-first) OHLC window as a JSON array, matching
//    the bridge's PredictRequest.ohlc contract.
string CollectOhlcJson(const string symbol, const ENUM_TIMEFRAMES timeframe, const int bar_count)
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(symbol, timeframe, 0, bar_count, rates);
   if(copied <= 0)
      return "[]";

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   string items = "";

   //--- CopyRates with ArraySetAsSeries(true) fills index 0 = most
   //    recent bar; the JSON contract wants chronological order
   //    (oldest first), so iterate backwards.
   for(int i = copied - 1; i >= 0; i--)
     {
      string bar = JsonObject(
         JsonFieldStr("time", FormatIsoTime(rates[i].time)) + "," +
         JsonFieldNum("open", rates[i].open, digits) + "," +
         JsonFieldNum("high", rates[i].high, digits) + "," +
         JsonFieldNum("low", rates[i].low, digits) + "," +
         JsonFieldNum("close", rates[i].close, digits) + "," +
         JsonFieldNum("volume", (double)rates[i].tick_volume, 0)
        );

      if(items != "")
         items += ",";
      items += bar;
     }

   return JsonArray(items);
  }

double CollectSpreadPoints(const string symbol)
  {
   long spread_points;
   if(!SymbolInfoInteger(symbol, SYMBOL_SPREAD, spread_points))
      return 0.0;
   return (double)spread_points;
  }

//--- Latest bar's tick volume, used as the JSON contract's "volume".
double CollectLatestVolume(const string symbol, const ENUM_TIMEFRAMES timeframe)
  {
   long volumes[];
   ArraySetAsSeries(volumes, true);
   if(CopyTickVolume(symbol, timeframe, 0, 1, volumes) <= 0)
      return 0.0;
   return (double)volumes[0];
  }

//--- Monetary value of a 1-point move for one standard lot of `symbol`
//    — needed by ai_brain.risk_ai (via the bridge) to size a lot from a
//    risk-percent recommendation.
double CollectPointValue(const string symbol)
  {
   double tick_value = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double tick_size  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   double point      = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(tick_size <= 0.0)
      return 0.0;
   return tick_value * (point / tick_size);
  }

#endif // MMXM_MARKET_DATA_COLLECTOR_MQH
