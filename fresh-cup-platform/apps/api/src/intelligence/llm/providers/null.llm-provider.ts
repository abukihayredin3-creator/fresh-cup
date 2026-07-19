import { Injectable } from "@nestjs/common";
import type {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmProvider,
} from "../llm-provider.interface";

/**
 * Ultimate fallback when LLM_PROVIDER=none (the default) or a selected
 * provider has no credentials configured — never calls out to the network.
 * Domain AI services must not depend on this producing prose; they fall
 * back to their own deterministic explanation templates when
 * `isConfigured` is false, exactly like Phase 6's AiAssistantService does
 * for its own askViaTemplate() path.
 */
@Injectable()
export class NullLlmProvider implements LlmProvider {
  readonly name = "none";
  readonly isConfigured = false;

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    return {
      text: "No LLM provider is configured — set LLM_PROVIDER and the matching API key to enable natural-language explanations.",
      toolCalls: [],
      stopReason: "end_turn",
    };
  }
}
