import { Injectable } from "@nestjs/common";
import { AiMemoryKind } from "@prisma/client";
import { AiMemoryService } from "./ai-memory.service";

export interface ConversationTurn {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

/**
 * "Conversation Memory" from the Phase 11 Part 3 spec — recalls a given
 * user's own prior conversation turns (each already written by
 * AssistantAiService/CopilotService as `AiMemoryKind.CONVERSATION`, keyed
 * by `authorUserId`), so a multi-turn chat surface can build context from
 * what this user asked before without re-sending the whole transcript.
 */
@Injectable()
export class ConversationMemoryService {
  constructor(private readonly memory: AiMemoryService) {}

  async recentTurns(userId: string, limit = 10): Promise<ConversationTurn[]> {
    const entries = await this.memory.recall({
      kind: AiMemoryKind.CONVERSATION,
      authorUserId: userId,
      limit,
    });
    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      createdAt: entry.createdAt,
    }));
  }
}
