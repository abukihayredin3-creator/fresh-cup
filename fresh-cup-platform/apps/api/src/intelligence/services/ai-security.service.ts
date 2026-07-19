import { Injectable } from "@nestjs/common";

/**
 * Guards the "Security" requirements from the Phase 7 spec: the AI must
 * refuse requests that would reveal confidential system data, and any
 * text it does produce (or that a tool result carries) must never expose
 * a real secret, even accidentally.
 */
@Injectable()
export class AiSecurityService {
  /**
   * Patterns describing what's being ASKED FOR — used to refuse a question
   * before it reaches an LLM/tool. Deliberately no `\b` word boundary
   * before compound identifiers like ANTHROPIC_API_KEY: `_` is a \w
   * character, so `\bapi` would never match inside `..._API_KEY`.
   */
  private static readonly LEAK_REQUEST_PATTERNS: RegExp[] = [
    /api[\s_-]?key(s)?/i,
    /\bsecret(s)?\b/i,
    /\bpassword(s)?\b/i,
    /(json\s?web\s?token|jwt)/i,
    /\bcredential(s)?\b/i,
    /database\s*(url|connection|credentials?)/i,
    /connection\s+string/i,
    /env(ironment)?[\s_-]?variable(s)?/i,
    /\.env\b/i,
    /system\s+prompt/i,
    /your\s+instructions/i,
    /private\s+key/i,
  ];

  /** Patterns describing the SHAPE of a real secret — used to scrub any text before it's returned. */
  private static readonly SECRET_SHAPE_PATTERNS: RegExp[] = [
    // Three base64url segments separated by dots — a JWT.
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    // Common vendor API key prefixes (OpenAI, Anthropic, Stripe, GitHub, ...).
    /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g,
    /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
    /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,
    // A connection string embedding credentials (host/path after @ may contain slashes).
    /\b\w+:\/\/[^\s:@/]+:[^\s:@/]+@[^\s]+/g,
    // A bearer token header value.
    /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi,
  ];

  /** True when a question is asking to be told a secret rather than asking about the business. */
  isSecretLeakRequest(question: string): boolean {
    return AiSecurityService.LEAK_REQUEST_PATTERNS.some((pattern) => pattern.test(question));
  }

  readonly refusalMessage =
    "I can't share API keys, passwords, secrets, tokens, credentials, or internal configuration — that's outside what this assistant is allowed to do. I can help with sales, inventory, customers, or forecasts instead.";

  /** Scrubs any secret-shaped substrings from arbitrary text (defense in depth — should never fire in practice). */
  redact(text: string): string {
    let result = text;
    for (const pattern of AiSecurityService.SECRET_SHAPE_PATTERNS) {
      result = result.replace(pattern, "[REDACTED]");
    }
    return result;
  }

  /** Recursively redacts every string value in a JSON-like structure — used by SecretRedactionInterceptor. */
  redactDeep<T>(value: T): T {
    if (typeof value === "string") {
      return this.redact(value) as unknown as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.redactDeep(item)) as unknown as T;
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.redactDeep(v);
      }
      return result as unknown as T;
    }
    return value;
  }
}
