/**
 * Provider-agnostic chat/tool-use contract. Every concrete provider
 * (Anthropic, OpenAI-compatible, Gemini, ...) translates this flattened
 * message array to/from its own wire format — callers (AgentRunnerService,
 * domain AI services) never touch a provider SDK directly, so swapping
 * LLM_PROVIDER never requires a code change outside llm/providers/.
 */
export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmMessage {
  role: LlmRole;
  /** Present for role "assistant" text and role "user"/"tool" content. */
  content?: string;
  /** Present only for role "assistant" when the model invoked tools. */
  toolCalls?: LlmToolCall[];
  /** Present only for role "tool" — which call this result answers. */
  toolCallId?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  inputSchema: Record<string, unknown>;
}

export interface LlmCompletionRequest {
  system?: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  maxTokens?: number;
}

export type LlmStopReason = "end_turn" | "tool_use" | "max_tokens";

export interface LlmCompletionResult {
  text: string | null;
  toolCalls: LlmToolCall[];
  stopReason: LlmStopReason;
}

export interface LlmProvider {
  readonly name: string;
  /** True when this provider can actually reach a real model (has credentials configured). */
  readonly isConfigured: boolean;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
