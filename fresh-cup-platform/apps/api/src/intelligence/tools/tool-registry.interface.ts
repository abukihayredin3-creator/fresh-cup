import type { RequestUser } from "../../common/types/request-user.interface";
import type { LlmToolDefinition } from "../llm/llm-provider.interface";

export interface AiToolExecutor {
  definition: LlmToolDefinition;
  run: (actor: RequestUser, input: Record<string, unknown>) => Promise<unknown>;
}

export type AiToolRegistry = Record<string, AiToolExecutor>;
