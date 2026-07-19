import type { AiMemoryKind } from "@prisma/client";

/**
 * In-process domain events for the Restaurant Intelligence Platform
 * (Phase 7) — dispatched via the same global EventEmitterModule used by
 * order/inventory/delivery events (see common/events/*.ts). Nothing
 * currently listens across module boundaries; these exist so a future
 * consumer (e.g. a notification when a manager rejects an AI suggestion
 * repeatedly) can subscribe without AiMemoryService knowing about it.
 */
export const AI_EVENTS = {
  MEMORY_RECORDED: "ai.memory.recorded",
  SUGGESTION_ACCEPTED: "ai.suggestion.accepted",
  SUGGESTION_REJECTED: "ai.suggestion.rejected",
} as const;

export interface AiMemoryRecordedEvent {
  memoryEntryId: string;
  kind: AiMemoryKind;
  domain: string;
  branchId: string | null;
}

export interface AiSuggestionOutcomeEvent {
  memoryEntryId: string;
  domain: string;
  actorUserId: string;
}
