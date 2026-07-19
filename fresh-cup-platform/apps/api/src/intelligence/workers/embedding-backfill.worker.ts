import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { PrismaService } from "../../database/prisma.service";
import { RagService } from "../rag/rag.service";

const NAMESPACE = "ai-memory";

/**
 * Indexes AiMemoryEntry rows into the vector store that weren't indexed at
 * write time — either because AI_RAG_ENABLED was off when they were
 * written, or a prior indexing attempt failed (AiMemoryService.remember()
 * treats indexing as best-effort and never fails the write). Invoked by
 * AiDailyDigestScheduler; safe to call repeatedly (upsert, not insert).
 */
@Injectable()
export class EmbeddingBackfillWorker {
  private readonly logger = new Logger(EmbeddingBackfillWorker.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  async run(batchSize = 100): Promise<number> {
    if (!this.config.get("AI_RAG_ENABLED", { infer: true })) return 0;

    const indexedIds = new Set(
      (
        await this.prisma.vectorEntry.findMany({
          where: { namespace: NAMESPACE },
          select: { id: true },
        })
      ).map((v) => v.id),
    );

    const candidates = await this.prisma.aiMemoryEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: batchSize * 4, // over-fetch since most recent entries are usually already indexed
      select: { id: true, title: true, content: true, domain: true, kind: true },
    });
    const unindexed = candidates.filter((c) => !indexedIds.has(c.id)).slice(0, batchSize);

    for (const entry of unindexed) {
      try {
        await this.rag.index(NAMESPACE, entry.id, `${entry.title}\n${entry.content}`, {
          domain: entry.domain,
          kind: entry.kind,
        });
      } catch (error) {
        this.logger.warn(`Backfill indexing failed for memory entry ${entry.id}: ${String(error)}`);
      }
    }
    return unindexed.length;
  }
}
