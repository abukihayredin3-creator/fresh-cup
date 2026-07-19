import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AiMemoryKind, type Prisma } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { PrismaService } from "../../database/prisma.service";
import { AI_EVENTS } from "../events/ai-events";
import { RagService } from "../rag/rag.service";

export interface RememberInput {
  kind: AiMemoryKind;
  domain: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  branchId?: string | null;
  subjectUserId?: string | null;
  authorUserId?: string | null;
}

export interface RecallFilter {
  domain?: string;
  kind?: AiMemoryKind;
  branchId?: string | null;
  authorUserId?: string;
  subjectUserId?: string;
  limit?: number;
}

/**
 * Long-term memory for the Restaurant Intelligence Platform (Phase 7) —
 * conversations, business decisions, recommendations, and accept/reject
 * outcomes, all auditable (Core Principle 4: every AI-generated action
 * must be auditable) and all persisted regardless of whether an LLM
 * provider is configured. A no-op when AI_MEMORY_ENABLED=false, so the
 * feature flag genuinely disables writes rather than just hiding a UI.
 */
@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly eventEmitter: EventEmitter2,
    private readonly rag: RagService,
  ) {}

  private get enabled(): boolean {
    return this.config.get("AI_MEMORY_ENABLED", { infer: true });
  }

  async remember(input: RememberInput): Promise<string | null> {
    if (!this.enabled) return null;

    const entry = await this.prisma.aiMemoryEntry.create({
      data: {
        kind: input.kind,
        domain: input.domain,
        title: input.title,
        content: input.content,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        branchId: input.branchId ?? undefined,
        subjectUserId: input.subjectUserId ?? undefined,
        authorUserId: input.authorUserId ?? undefined,
      },
    });

    this.eventEmitter.emit(AI_EVENTS.MEMORY_RECORDED, {
      memoryEntryId: entry.id,
      kind: entry.kind,
      domain: entry.domain,
      branchId: entry.branchId,
    });

    // Best-effort: RAG indexing must never block or fail a memory write.
    this.rag
      .index("ai-memory", entry.id, `${input.title}\n${input.content}`, {
        domain: input.domain,
        kind: input.kind,
      })
      .catch((error: unknown) => {
        this.logger.warn(`RAG indexing failed for memory entry ${entry.id}: ${String(error)}`);
      });

    return entry.id;
  }

  async recall(filter: RecallFilter = {}) {
    return this.prisma.aiMemoryEntry.findMany({
      where: {
        domain: filter.domain,
        kind: filter.kind,
        branchId: filter.branchId === undefined ? undefined : filter.branchId,
        authorUserId: filter.authorUserId,
        subjectUserId: filter.subjectUserId,
      },
      orderBy: { createdAt: "desc" },
      take: filter.limit ?? 20,
    });
  }

  /** Semantic recall via RAG — falls back to recent-first recall when AI_RAG_ENABLED is off. */
  async recallRelevant(domain: string, query: string, topK = 5) {
    if (!this.config.get("AI_RAG_ENABLED", { infer: true })) {
      return this.recall({ domain, limit: topK });
    }
    const matches = await this.rag.retrieve("ai-memory", query, topK);
    const ids = matches.map((m) => m.id);
    if (ids.length === 0) return [];
    const entries = await this.prisma.aiMemoryEntry.findMany({
      where: { id: { in: ids }, domain },
    });
    const byId = new Map(entries.map((e) => [e.id, e]));
    return ids.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  }

  /**
   * Records whether a manager accepted or rejected a prior AI
   * recommendation — Core Principle: AI assists humans, and every
   * recommendation's outcome should be traceable.
   */
  async recordSuggestionOutcome(
    memoryEntryId: string,
    accepted: boolean,
    actorUserId: string,
  ): Promise<void> {
    const original = await this.prisma.aiMemoryEntry.findUnique({ where: { id: memoryEntryId } });
    if (!original) return;

    await this.remember({
      kind: accepted ? AiMemoryKind.ACCEPTED_SUGGESTION : AiMemoryKind.REJECTED_SUGGESTION,
      domain: original.domain,
      title: original.title,
      content: original.content,
      metadata: {
        ...(original.metadata as Record<string, unknown> | null),
        originalMemoryEntryId: memoryEntryId,
      },
      branchId: original.branchId,
      authorUserId: actorUserId,
    });

    this.eventEmitter.emit(
      accepted ? AI_EVENTS.SUGGESTION_ACCEPTED : AI_EVENTS.SUGGESTION_REJECTED,
      { memoryEntryId, domain: original.domain, actorUserId },
    );
  }

  /**
   * Phase 11 Part 3's "Restaurant Memory" categories — thin, typed wrappers
   * over `remember()` so callers don't have to remember which
   * `AiMemoryKind` maps to which real-world event. Each still goes through
   * the same enabled-flag check, event emission, and RAG indexing as any
   * other memory write.
   */
  rememberCustomerPreference(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.CUSTOMER_PREFERENCE });
  }

  rememberManagerFeedback(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.MANAGER_FEEDBACK });
  }

  rememberCampaignHistory(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.CAMPAIGN_HISTORY });
  }

  rememberSupplierIssue(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.SUPPLIER_ISSUE });
  }

  rememberInventoryFailure(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.INVENTORY_FAILURE });
  }

  rememberHolidayDemand(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.HOLIDAY_DEMAND });
  }

  rememberBranchBehavior(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.BRANCH_BEHAVIOR });
  }

  rememberStaffPerformance(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.STAFF_PERFORMANCE });
  }

  rememberLearningDigest(input: Omit<RememberInput, "kind">): Promise<string | null> {
    return this.remember({ ...input, kind: AiMemoryKind.LEARNING_DIGEST });
  }
}
