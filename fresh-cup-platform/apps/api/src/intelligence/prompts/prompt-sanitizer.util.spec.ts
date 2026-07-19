import { sanitizeForPrompt } from "./prompt-sanitizer.util";

describe("sanitizeForPrompt", () => {
  it("strips control characters", () => {
    expect(sanitizeForPrompt("hello\x00\x01world")).toBe("helloworld");
  });

  it("leaves normal text and newlines/tabs untouched", () => {
    const text = "line one\nline two\ttabbed";
    expect(sanitizeForPrompt(text)).toBe(text);
  });

  it("truncates text past the max segment length", () => {
    const huge = "a".repeat(5000);
    const result = sanitizeForPrompt(huge);
    expect(result.length).toBeLessThan(5000);
    expect(result.endsWith("(truncated)")).toBe(true);
  });
});
