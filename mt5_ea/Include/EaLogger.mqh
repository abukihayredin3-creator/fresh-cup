//+------------------------------------------------------------------+
//|                                                  EaLogger.mqh    |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| Append-only file logger for the EA side, writing to
//| MQL5/Files/mmxm_ea_log_YYYYMMDD.log (one file per day, rotated
//| automatically at midnight terminal time). Every request, response,
//| execution, rejection, and error goes through this so there's a full,
//| replayable audit trail on the terminal side too — mirroring what the
//| bridge logs on its own side.
//+------------------------------------------------------------------+
#ifndef MMXM_EA_LOGGER_MQH
#define MMXM_EA_LOGGER_MQH

string g_mmxm_log_date   = "";
int    g_mmxm_log_handle = INVALID_HANDLE;

void EaLogEnsureOpen()
  {
   string today = TimeToString(TimeCurrent(), TIME_DATE);
   StringReplace(today, ".", "");

   if(today == g_mmxm_log_date && g_mmxm_log_handle != INVALID_HANDLE)
      return;

   if(g_mmxm_log_handle != INVALID_HANDLE)
      FileClose(g_mmxm_log_handle);

   string filename = "mmxm_ea_log_" + today + ".log";
   g_mmxm_log_handle = FileOpen(filename, FILE_READ | FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ);

   if(g_mmxm_log_handle != INVALID_HANDLE)
     {
      FileSeek(g_mmxm_log_handle, 0, SEEK_END);
      g_mmxm_log_date = today;
     }
  }

void EaLog(const string category, const string message)
  {
   EaLogEnsureOpen();

   //--- Always mirror to the terminal's own Experts log, so nothing is
   //    silent even if the file couldn't be opened for some reason.
   Print("MMXM_EA [", category, "] ", message);

   if(g_mmxm_log_handle == INVALID_HANDLE)
      return;

   string line = TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS) + " [" + category + "] " + message;
   FileWriteString(g_mmxm_log_handle, line + "\r\n");
   FileFlush(g_mmxm_log_handle);
  }

void EaLogRequest(const string request_id, const string symbol, const string payload)
  {
   EaLog("REQUEST", request_id + " " + symbol + " " + payload);
  }

void EaLogResponse(const string request_id, const string body)
  {
   EaLog("RESPONSE", request_id + " " + body);
  }

void EaLogExecution(const string request_id, const string action, const double lot, const double sl, const double tp)
  {
   EaLog("EXECUTION", StringFormat("%s action=%s lot=%.2f sl=%.5f tp=%.5f", request_id, action, lot, sl, tp));
  }

void EaLogRejected(const string request_id, const string reason)
  {
   EaLog("REJECTED", request_id + " reason=" + reason);
  }

void EaLogTradeResult(const string trade_id, const string outcome, const double pnl)
  {
   EaLog("TRADE_RESULT", StringFormat("%s outcome=%s pnl=%.2f", trade_id, outcome, pnl));
  }

void EaLogError(const string context, const string message)
  {
   EaLog("ERROR", context + ": " + message);
  }

void EaLogClose()
  {
   if(g_mmxm_log_handle != INVALID_HANDLE)
     {
      FileClose(g_mmxm_log_handle);
      g_mmxm_log_handle = INVALID_HANDLE;
     }
  }

#endif // MMXM_EA_LOGGER_MQH
