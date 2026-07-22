//+------------------------------------------------------------------+
//|                                                  HttpClient.mqh  |
//|                                MMXM AI Brain EA - MT5 Bridge     |
//+------------------------------------------------------------------+
//| Thin wrapper around WebRequest(): request/response encoding,
//| timeouts, HTTP status handling.
//|
//| The MT5 terminal must have the bridge's base URL whitelisted under
//| Tools -> Options -> Expert Advisors -> "Allow WebRequest for listed
//| URL" (see mt5_ea/README.md) — otherwise every call here returns
//| status -1 with GetLastError() == 4060.
//+------------------------------------------------------------------+
#ifndef MMXM_HTTP_CLIENT_MQH
#define MMXM_HTTP_CLIENT_MQH

struct HttpResult
  {
   bool     success;
   int      status_code;
   string   body;
   string   error;
  };

//--- POST a JSON body, return the parsed HTTP result. success=true only
//    for 2xx responses; the body is still returned on non-2xx so the
//    caller can log it, just success=false. ``api_key`` is optional —
//    pass "" (the default) when the bridge has no security.api_key
//    configured; a non-empty value is sent as an X-API-Key header.
HttpResult HttpPost(const string url, const string json_body, const int timeout_ms, const string api_key = "")
  {
   HttpResult result;
   result.success     = false;
   result.status_code = -1;
   result.body        = "";
   result.error       = "";

   uchar request_data[];
   int   encoded_len = StringToCharArray(json_body, request_data, 0, -1, CP_UTF8);
   //--- StringToCharArray null-terminates the buffer; trim that trailing
   //    zero byte so the HTTP body isn't padded with an extra NUL.
   if(encoded_len > 0)
      ArrayResize(request_data, encoded_len - 1);

   uchar  response_data[];
   string response_headers;
   string request_headers = "Content-Type: application/json\r\n";
   if(api_key != "")
      request_headers += "X-API-Key: " + api_key + "\r\n";

   ResetLastError();
   int status = WebRequest("POST", url, request_headers, timeout_ms, request_data, response_data, response_headers);

   if(status == -1)
     {
      int err = GetLastError();
      result.error = StringFormat(
         "WebRequest failed, error %d (is '%s' whitelisted under Tools->Options->Expert Advisors?)",
         err, url);
      return result;
     }

   result.status_code = status;
   result.body        = CharArrayToString(response_data, 0, -1, CP_UTF8);
   result.success      = (status >= 200 && status < 300);
   if(!result.success)
      result.error = StringFormat("Bridge returned HTTP %d: %s", status, result.body);

   return result;
  }

//--- GET request (used for the /health check in OnInit — /health is
//    never gated by an API key, so this intentionally has no api_key
//    parameter).
HttpResult HttpGet(const string url, const int timeout_ms)
  {
   HttpResult result;
   result.success     = false;
   result.status_code = -1;
   result.body        = "";
   result.error       = "";

   uchar  request_data[];
   uchar  response_data[];
   string response_headers;

   ResetLastError();
   int status = WebRequest("GET", url, "", timeout_ms, request_data, response_data, response_headers);

   if(status == -1)
     {
      int err = GetLastError();
      result.error = StringFormat(
         "WebRequest failed, error %d (is '%s' whitelisted under Tools->Options->Expert Advisors?)",
         err, url);
      return result;
     }

   result.status_code = status;
   result.body        = CharArrayToString(response_data, 0, -1, CP_UTF8);
   result.success      = (status >= 200 && status < 300);
   return result;
  }

#endif // MMXM_HTTP_CLIENT_MQH
