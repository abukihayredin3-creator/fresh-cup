import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmMessage,
  LlmProvider,
  LlmStopReason,
  LlmToolCall,
} from "../llm-provider.interface";

/** Translates the flattened LlmMessage[] shape to/from Anthropic's Messages API. */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly isConfigured: boolean;
  private readonly client: Anthropic | null;

  constructor(
    apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.isConfigured = Boolean(apiKey);
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.client) {
      throw new Error("AnthropicLlmProvider used without ANTHROPIC_API_KEY configured");
    }

    const messages = this.toAnthropicMessages(request.messages);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      system: request.system,
      thinking: { type: "adaptive" },
      tools: request.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      messages,
    });

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    const toolCalls: LlmToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));

    return {
      text: text ?? null,
      toolCalls,
      stopReason: this.toStopReason(response.stop_reason),
    };
  }

  private toStopReason(reason: string | null): LlmStopReason {
    if (reason === "tool_use") return "tool_use";
    if (reason === "max_tokens") return "max_tokens";
    return "end_turn";
  }

  private toAnthropicMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    for (const message of messages) {
      if (message.role === "system") continue; // carried separately as `system`
      if (message.role === "user") {
        result.push({ role: "user", content: message.content ?? "" });
        continue;
      }
      if (message.role === "assistant") {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (message.content) blocks.push({ type: "text", text: message.content });
        for (const call of message.toolCalls ?? []) {
          blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
        }
        result.push({ role: "assistant", content: blocks });
        continue;
      }
      // role "tool" — Anthropic expects tool results wrapped in a user turn.
      result.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolCallId ?? "",
            content: message.content ?? "",
          },
        ],
      });
    }
    return result;
  }
}
