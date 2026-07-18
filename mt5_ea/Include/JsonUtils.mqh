//+------------------------------------------------------------------+
//|                                                    JsonUtils.mqh |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| Minimal JSON helpers.
//|
//| This is intentionally NOT a general-purpose JSON library. It only
//| builds the fixed request shape the bridge expects (via the
//| JsonField*/JsonObject/JsonArray builders) and only reads the fixed,
//| flat response shape the bridge returns — the PredictResponse schema
//| has no nested objects or arrays, so a full recursive parser would be
//| overkill for a contract this narrow and fixed. If the contract ever
//| grows nested response fields, this file is the place to extend.
//+------------------------------------------------------------------+
#ifndef MMXM_JSON_UTILS_MQH
#define MMXM_JSON_UTILS_MQH

//--- Escape a string for safe embedding inside a JSON string literal.
//    Order matters: backslashes must be escaped first, otherwise the
//    backslashes introduced by the later replacements would themselves
//    get re-escaped.
string JsonEscape(const string text)
  {
   string out = text;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   StringReplace(out, "\n", "\\n");
   StringReplace(out, "\r", "\\r");
   StringReplace(out, "\t", "\\t");
   return out;
  }

//--- Fragment builders: each returns `"key":value` (no surrounding
//    braces or trailing comma — the caller joins fragments with commas
//    and wraps the result in JsonObject()/JsonArray()).
string JsonFieldStr(const string key, const string value)
  {
   return "\"" + key + "\":\"" + JsonEscape(value) + "\"";
  }

string JsonFieldNum(const string key, const double value, const int digits = 6)
  {
   return "\"" + key + "\":" + DoubleToString(value, digits);
  }

string JsonFieldInt(const string key, const long value)
  {
   return "\"" + key + "\":" + IntegerToString(value);
  }

string JsonFieldBool(const string key, const bool value)
  {
   return "\"" + key + "\":" + (value ? "true" : "false");
  }

//--- MT5 bar/deal timestamps are in the broker's server time, not
//    necessarily true UTC — see mt5_ea/README.md for the caveat this
//    implies. Format as an ISO-8601-shaped string for the JSON wire
//    format regardless.
string FormatIsoTime(const datetime t)
  {
   string s = TimeToString(t, TIME_DATE | TIME_SECONDS);
   StringReplace(s, ".", "-");
   StringReplace(s, " ", "T");
   return s + "Z";
  }

//--- Wrap a comma-joined list of fragments in a JSON object.
string JsonObject(const string fields)
  {
   return "{" + fields + "}";
  }

//--- Wrap a comma-joined list of object strings in a JSON array.
string JsonArray(const string items)
  {
   return "[" + items + "]";
  }

//--- Locate the raw value substring for `"key":` in a flat JSON object.
//    Sets found=false and returns "" if the key isn't present. The
//    returned raw string still has its surrounding quotes for string
//    values (stripped by JsonGetString below).
string JsonRawValue(const string json, const string key, bool &found)
  {
   string needle = "\"" + key + "\":";
   int pos = StringFind(json, needle);
   if(pos < 0)
     {
      found = false;
      return "";
     }

   int start = pos + StringLen(needle);
   int len   = StringLen(json);

   while(start < len && StringGetCharacter(json, start) == ' ')
      start++;

   if(start >= len)
     {
      found = false;
      return "";
     }

   ushort first_char = StringGetCharacter(json, start);
   int endPos = len;

   if(first_char == '"')
     {
      //--- string value: scan for the closing quote, skipping escaped quotes
      int i = start + 1;
      while(i < len)
        {
         ushort c = StringGetCharacter(json, i);
         if(c == '\\')
           {
            i += 2;
            continue;
           }
         if(c == '"')
            break;
         i++;
        }
      endPos = i + 1;
     }
   else
     {
      //--- number / true / false / null: ends at the next comma or closing brace
      int i = start;
      while(i < len)
        {
         ushort c = StringGetCharacter(json, i);
         if(c == ',' || c == '}')
            break;
         i++;
        }
      endPos = i;
     }

   found = true;
   return StringSubstr(json, start, endPos - start);
  }

//--- Reverse JsonEscape in a single left-to-right pass. A sequence of
//    independent StringReplace calls (one per escape kind) cannot
//    correctly reverse escaping in general: the backslash-doubling
//    replace runs last, but replacing "\n"/"\r"/"\t" runs BEFORE it can
//    see whether a given backslash was itself an escaped literal
//    backslash — a value containing a literal backslash immediately
//    followed by a literal 'n'/'r'/'t' character would be corrupted by
//    that ordering. Scanning once, left to right, has no such hazard.
string JsonUnescape(const string text)
  {
   int len = StringLen(text);
   string result = "";
   int i = 0;

   while(i < len)
     {
      ushort c = StringGetCharacter(text, i);
      if(c == '\\' && i + 1 < len)
        {
         ushort next = StringGetCharacter(text, i + 1);
         if(next == '"' || next == '\\')
           {
            result += StringSubstr(text, i + 1, 1);
            i += 2;
            continue;
           }
         if(next == 'n')
           {
            result += "\n";
            i += 2;
            continue;
           }
         if(next == 'r')
           {
            result += "\r";
            i += 2;
            continue;
           }
         if(next == 't')
           {
            result += "\t";
            i += 2;
            continue;
           }
         //--- unrecognized escape: keep the backslash literally and
         //    continue from the next character, rather than guessing.
        }
      result += StringSubstr(text, i, 1);
      i++;
     }

   return result;
  }

string JsonGetString(const string json, const string key, const string defaultValue = "")
  {
   bool found = false;
   string raw = JsonRawValue(json, key, found);
   if(!found || raw == "null")
      return defaultValue;

   if(StringLen(raw) >= 2 && StringGetCharacter(raw, 0) == '"')
      raw = StringSubstr(raw, 1, StringLen(raw) - 2);

   return JsonUnescape(raw);
  }

double JsonGetDouble(const string json, const string key, const double defaultValue = 0.0)
  {
   bool found = false;
   string raw = JsonRawValue(json, key, found);
   if(!found || raw == "null" || raw == "")
      return defaultValue;
   return StringToDouble(raw);
  }

bool JsonGetBoolValue(const string json, const string key, const bool defaultValue = false)
  {
   bool found = false;
   string raw = JsonRawValue(json, key, found);
   if(!found)
      return defaultValue;
   return (raw == "true");
  }

//--- Whether `key` is present and not JSON null — used for the
//    nullable response fields (lot_size, stop_loss, take_profit,
//    risk_percent, rejected_reason).
bool JsonHasNonNullKey(const string json, const string key)
  {
   bool found = false;
   string raw = JsonRawValue(json, key, found);
   return (found && raw != "null");
  }

#endif // MMXM_JSON_UTILS_MQH
