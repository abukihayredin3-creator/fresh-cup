import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { PrismaService } from "../../database/prisma.service";
import { RagService } from "../rag/rag.service";

const NAMESPACE = "ai-knowledge-base";

/**
 * Batch worker mirroring `EmbeddingBackfillWorker`'s job, for
 * `AiKnowledgeDocument` instead of `AiMemoryEntry` — indexes any
 * knowledge document that isn't yet in the vector store (RAG disabled at
 * write time, or a prior indexing call failed silently). Safe to call
 * repeatedly (upsert, not insert). Invoked nightly by
 * `AiDailyDigestScheduler`.
 */
@Injectable()
export class KnowledgeBaseIndexWorker {
  private readonly logger = new Logger(KnowledgeBaseIndexWorker.name);

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

    const candidates = await this.prisma.aiKnowledgeDocument.findMany({
      orderBy: { updatedAt: "desc" },
      take: batchSize * 4,
      select: { id: true, title: true, content: true, category: true, sourceFormat: true },
    });
    const unindexed = candidates.filter((c) => !indexedIds.has(c.id)).slice(0, batchSize);

    for (const doc of unindexed) {
      try {
        await this.rag.index(NAMESPACE, doc.id, `${doc.title}\n${doc.content}`, {
          category: doc.category,
          sourceFormat: doc.sourceFormat,
        });
      } catch (error) {
        this.logger.warn(
          `Backfill indexing failed for knowledge document ${doc.id}: ${String(error)}`,
        );
      }
    }
    return unindexed.length;
  }
}
