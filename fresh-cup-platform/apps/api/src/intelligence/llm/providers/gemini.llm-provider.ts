import type {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmMessage,
  LlmProvider,
  LlmToolCall,
} from "../llm-provider.interface";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
}

/** Fetch-based client for Google's Generative Language API (`generateContent`). */
export class GeminiLlmProvider implements LlmProvider {
  readonly name = "gemini";
  readonly isConfigured: boolean;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly baseUrl: string = "https://generativelanguage.googleapis.com/v1beta",
  ) {
    this.isConfigured = Boolean(apiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.isConfigured) {
      throw new Error("GeminiLlmProvider used without GEMINI_API_KEY configured");
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
        contents: this.toGeminiContents(request.messages),
        tools: request.tools?.length
          ? [
              {
                functionDeclarations: request.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                })),
              },
            ]
          : undefined,
        generationConfig: { maxOutputTokens: request.maxTokens ?? 1024 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const parts = body.candidates?.[0]?.content?.parts ?? [];
    const text = parts.find((p) => p.text)?.text ?? null;
    const toolCalls: LlmToolCall[] = parts
      .filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } =>
        Boolean(p.functionCall),
      )
      .map((p, index) => ({
        id: `${p.functionCall.name}-${index}`,
        name: p.functionCall.name,
        input: p.functionCall.args,
      }));

    return {
      text,
      toolCalls,
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
    };
  }

  private toGeminiContents(messages: LlmMessage[]): GeminiContent[] {
    const result: GeminiContent[] = [];
    for (const message of messages) {
      if (message.role === "system") continue;
      if (message.role === "user") {
        result.push({ role: "user", parts: [{ text: message.content ?? "" }] });
        continue;
      }
      if (message.role === "assistant") {
        const parts: GeminiPart[] = [];
        if (message.content) parts.push({ text: message.content });
        for (const call of message.toolCalls ?? []) {
          parts.push({ functionCall: { name: call.name, args: call.input } });
        }
        result.push({ role: "model", parts });
        continue;
      }
      // role "tool" -> Gemini models this as a user-turn functionResponse part.
      result.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.toolCallId ?? "unknown",
              response: { content: message.content ?? "" },
            },
          },
        ],
      });
    }
    return result;
  }
}
