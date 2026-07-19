import { OpenAiCompatibleLlmProvider } from "./openai-compatible.llm-provider";

describe("OpenAiCompatibleLlmProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("throws when used without an API key and one is required", async () => {
    const provider = new OpenAiCompatibleLlmProvider(
      "openai",
      "https://api.openai.com/v1",
      undefined,
      "gpt-4o",
    );
    expect(provider.isConfigured).toBe(false);
    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/API key/);
  });

  it("parses a plain text completion", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "42" }, finish_reason: "stop" }],
      }),
    }) as unknown as typeof fetch;

    const provider = new OpenAiCompatibleLlmProvider(
      "openai",
      "https://api.openai.com/v1",
      "sk-test",
      "gpt-4o",
    );
    const result = await provider.complete({
      messages: [{ role: "user", content: "what is 6*7?" }],
    });

    expect(result.text).toBe("42");
    expect(result.stopReason).toBe("end_turn");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("parses a tool-call completion and maps finish_reason to tool_use", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: { name: "get_sales_summary", arguments: '{"branchId":"b1"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const provider = new OpenAiCompatibleLlmProvider(
      "openai",
      "https://api.openai.com/v1",
      "sk-test",
      "gpt-4o",
    );
    const result = await provider.complete({
      messages: [{ role: "user", content: "how were sales?" }],
      tools: [{ name: "get_sales_summary", description: "sales", inputSchema: { type: "object" } }],
    });

    expect(result.stopReason).toBe("tool_use");
    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "get_sales_summary", input: { branchId: "b1" } },
    ]);
  });

  it("uses an api-key header instead of Authorization when authStyle=api-key (Azure)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAiCompatibleLlmProvider(
      "azure-openai",
      "https://example.openai.azure.com/openai/deployments/gpt-4o",
      "azure-key",
      "gpt-4o",
      true,
      "api-key",
      "?api-version=2024-10-21",
    );
    await provider.complete({ messages: [{ role: "user", content: "hi" }] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://example.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21",
    );
    expect((init.headers as Record<string, string>)["api-key"]).toBe("azure-key");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("throws a descriptive error on a non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    }) as unknown as typeof fetch;

    const provider = new OpenAiCompatibleLlmProvider(
      "openai",
      "https://api.openai.com/v1",
      "sk-bad",
      "gpt-4o",
    );
    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/401/);
  });
});
