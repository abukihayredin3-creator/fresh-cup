const MAX_PROMPT_SEGMENT_LENGTH = 4000;

/**
 * Structural cleanup for any text headed into an LLM prompt (a tool
 * result, a user question, a memory-entry excerpt): strips control
 * characters that could confuse a provider's tokenizer and caps length so
 * one oversized field can't blow the context budget. This is separate
 * from AiSecurityService.redact(), which scrubs secret-shaped substrings
 * — this util only handles structural safety, not confidentiality.
 */
export function sanitizeForPrompt(text: string): string {
  // eslint-disable-next-line no-control-regex
  const stripped = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  return stripped.length > MAX_PROMPT_SEGMENT_LENGTH
    ? `${stripped.slice(0, MAX_PROMPT_SEGMENT_LENGTH)}… (truncated)`
    : stripped;
}
