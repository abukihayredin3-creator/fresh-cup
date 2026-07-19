import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { LLM_PROVIDER_TOKEN } from "../llm/llm-provider.factory";
import type { LlmMessage, LlmProvider } from "../llm/llm-provider.interface";
import { sanitizeForPrompt } from "../prompts/prompt-sanitizer.util";
import { AiSecurityService } from "./ai-security.service";
import type { AiToolRegistry } from "../tools/tool-registry.interface";

const MAX_TOOL_ITERATIONS = 4;

export interface AgentRunRequest {
  system: string;
  question: string;
  tools: AiToolRegistry;
  actor: RequestUser;
  context?: Record<string, unknown>;
}

export interface AgentRunResult {
  text: string;
  toolCalls: { tool: string; input: Record<string, unknown>; result: unknown }[];
  usedLlm: boolean;
}

/**
 * Provider-agnostic version of the tool-use loop Phase 6's
 * AiAssistantService hand-writes against the Anthropic SDK directly — this
 * one drives any LlmProvider (LLM_PROVIDER_TOKEN), so every domain AI
 * service gets the same "ground every answer in real tool output" loop
 * without depending on a specific vendor SDK. Phase 6's AiAssistantService
 * is untouched; this is new, additive infrastructure for the new domains.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly llm: LlmProvider,
    private readonly security: AiSecurityService,
  ) {}

  get isLlmConfigured(): boolean {
    return this.llm.isConfigured;
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    if (this.security.isSecretLeakRequest(request.question)) {
      return { text: this.security.refusalMessage, toolCalls: [], usedLlm: false };
    }
    if (!this.llm.isConfigured) {
      return { text: "", toolCalls: [], usedLlm: false };
    }

    const toolCallLog: AgentRunResult["toolCalls"] = [];
    const messages: LlmMessage[] = [{ role: "user", content: sanitizeForPrompt(request.question) }];
    const toolDefinitions = Object.values(request.tools).map((t) => t.definition);

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await this.llm.complete({
        system: request.system,
        messages,
        tools: toolDefinitions,
      });

      if (response.stopReason !== "tool_use" || response.toolCalls.length === 0) {
        return {
          text: this.security.redact(response.text ?? "I couldn't find an answer to that."),
          toolCalls: toolCallLog,
          usedLlm: true,
        };
      }

      messages.push({
        role: "assistant",
        content: response.text ?? undefined,
        toolCalls: response.toolCalls,
      });

      for (const call of response.toolCalls) {
        const executor = request.tools[call.name];
        const input = { ...call.input, ...(request.context ?? {}) };
        let result: unknown;
        try {
          result = executor
            ? await executor.run(request.actor, input)
            : { error: `Unknown tool ${call.name}` };
        } catch (error) {
          this.logger.warn(`Tool ${call.name} failed: ${String(error)}`);
          result = { error: "Tool execution failed" };
        }
        toolCallLog.push({ tool: call.name, input: call.input, result });
        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: sanitizeForPrompt(JSON.stringify(result)),
        });
      }
    }

    return {
      text: "I gathered some data but couldn't finish reasoning about it in time — try a narrower question.",
      toolCalls: toolCallLog,
      usedLlm: true,
    };
  }
}
