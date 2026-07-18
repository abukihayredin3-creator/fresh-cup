//+------------------------------------------------------------------+
//|                                          AccountCollector.mqh    |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| Collects account state and open-position data. Pure reading — no
//| trading decisions, just what the terminal already knows.
//+------------------------------------------------------------------+
#ifndef MMXM_ACCOUNT_COLLECTOR_MQH
#define MMXM_ACCOUNT_COLLECTOR_MQH
#include <JsonUtils.mqh>

double CollectBalance()     { return AccountInfoDouble(ACCOUNT_BALANCE); }
double CollectEquity()      { return AccountInfoDouble(ACCOUNT_EQUITY); }
double CollectFreeMargin()  { return AccountInfoDouble(ACCOUNT_MARGIN_FREE); }
double CollectMarginLevel() { return AccountInfoDouble(ACCOUNT_MARGIN_LEVEL); }

//--- Number of open positions for this EA (filtered by magic number;
//    pass 0 to count every position on the account regardless of magic).
int CountOpenPositions(const long magic_number)
  {
   int count = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(magic_number > 0 && PositionGetInteger(POSITION_MAGIC) != magic_number)
         continue;
      count++;
     }
   return count;
  }

int CountOpenPositionsForSymbol(const string symbol, const long magic_number)
  {
   int count = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      if(magic_number > 0 && PositionGetInteger(POSITION_MAGIC) != magic_number)
         continue;
      count++;
     }
   return count;
  }

//--- Total risk currently exposed across open positions, as a percent
//    of account balance: sum of (entry-to-SL price distance converted
//    to money via tick value/size * lot size) across every open
//    position that has a stop loss set. Positions without an SL can't
//    have their risk quantified and are skipped (not assumed zero-risk
//    — genuinely unknown).
double CollectOpenRiskPercent(const long magic_number)
  {
   double balance = CollectBalance();
   if(balance <= 0.0)
      return 0.0;

   double total_risk_amount = 0.0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(magic_number > 0 && PositionGetInteger(POSITION_MAGIC) != magic_number)
         continue;

      double sl = PositionGetDouble(POSITION_SL);
      if(sl <= 0.0)
         continue;

      string symbol     = PositionGetString(POSITION_SYMBOL);
      double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      double volume     = PositionGetDouble(POSITION_VOLUME);

      double tick_value = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      double tick_size  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      if(tick_size <= 0.0)
         continue;

      double price_distance = MathAbs(open_price - sl);
      double risk_amount    = price_distance * (tick_value / tick_size) * volume;
      total_risk_amount += risk_amount;
     }

   return (total_risk_amount / balance) * 100.0;
  }

//--- Serialize every open position (filtered by magic number, 0 = all)
//    into the JSON contract's "existing_positions" array.
string CollectExistingPositionsJson(const long magic_number)
  {
   string items = "";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(magic_number > 0 && PositionGetInteger(POSITION_MAGIC) != magic_number)
         continue;

      string symbol    = PositionGetString(POSITION_SYMBOL);
      long   type       = PositionGetInteger(POSITION_TYPE);
      string direction  = (type == POSITION_TYPE_BUY) ? "buy" : "sell";
      int    digits     = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      string item = JsonObject(
         JsonFieldInt("ticket", (long)ticket) + "," +
         JsonFieldStr("symbol", symbol) + "," +
         JsonFieldStr("direction", direction) + "," +
         JsonFieldNum("lot_size", PositionGetDouble(POSITION_VOLUME), 2) + "," +
         JsonFieldNum("open_price", PositionGetDouble(POSITION_PRICE_OPEN), digits) + "," +
         JsonFieldNum("sl", PositionGetDouble(POSITION_SL), digits) + "," +
         JsonFieldNum("tp", PositionGetDouble(POSITION_TP), digits) + "," +
         JsonFieldNum("profit", PositionGetDouble(POSITION_PROFIT), 2)
        );

      if(items != "")
         items += ",";
      items += item;
     }

   return JsonArray(items);
  }

#endif // MMXM_ACCOUNT_COLLECTOR_MQH
