import type {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmMessage,
  LlmProvider,
  LlmStopReason,
  LlmToolCall,
} from "../llm-provider.interface";

interface OpenAiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface OpenAiChatCompletionResponse {
  choices: {
    message: {
      content: string | null;
      tool_calls?: {
        id: string;
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason: string;
  }[];
}

/**
 * OpenAI's `/chat/completions` wire format is shared, byte-for-byte, by
 * OpenAI itself, Azure OpenAI, OpenRouter, and local Ollama (its OpenAI
 * compatibility layer) — one fetch-based implementation covers all four
 * LLM_PROVIDER values, configured only by base URL / API key / model, with
 * no per-vendor SDK dependency.
 */
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly isConfigured: boolean;

  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly model: string,
    /** Ollama needs no API key; OpenAI/Azure/OpenRouter do. */
    private readonly requiresApiKey: boolean = true,
    /** Azure OpenAI authenticates with a raw `api-key` header, not `Authorization: Bearer`. */
    private readonly authStyle: "bearer" | "api-key" = "bearer",
    /** Azure OpenAI's URL carries `?api-version=...`; every other provider leaves this empty. */
    private readonly urlSuffix: string = "",
  ) {
    this.isConfigured = this.requiresApiKey ? Boolean(apiKey) : true;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.isConfigured) {
      throw new Error(`${this.name} LLM provider used without an API key configured`);
    }

    const messages: OpenAiChatMessage[] = [];
    if (request.system) messages.push({ role: "system", content: request.system });
    messages.push(...this.toOpenAiMessages(request.messages));

    const response = await fetch(`${this.baseUrl}/chat/completions${this.urlSuffix}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey
          ? this.authStyle === "api-key"
            ? { "api-key": this.apiKey }
            : { Authorization: `Bearer ${this.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        tools: request.tools?.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `${this.name} LLM request failed: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as OpenAiChatCompletionResponse;
    const choice = body.choices[0];
    if (!choice) {
      return { text: null, toolCalls: [], stopReason: "end_turn" };
    }

    const toolCalls: LlmToolCall[] = (choice.message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      input: this.parseArguments(call.function.arguments),
    }));

    return {
      text: choice.message.content,
      toolCalls,
      stopReason: this.toStopReason(choice.finish_reason),
    };
  }

  private parseArguments(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private toStopReason(reason: string): LlmStopReason {
    if (reason === "tool_calls") return "tool_use";
    if (reason === "length") return "max_tokens";
    return "end_turn";
  }

  private toOpenAiMessages(messages: LlmMessage[]): OpenAiChatMessage[] {
    return messages
      .filter((m) => m.role !== "system")
      .map((message) => {
        if (message.role === "assistant" && message.toolCalls?.length) {
          return {
            role: "assistant",
            content: message.content ?? null,
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: JSON.stringify(call.input) },
            })),
          };
        }
        if (message.role === "tool") {
          return { role: "tool", content: message.content ?? "", tool_call_id: message.toolCallId };
        }
        return { role: message.role as "user" | "assistant", content: message.content ?? "" };
      });
  }
}
