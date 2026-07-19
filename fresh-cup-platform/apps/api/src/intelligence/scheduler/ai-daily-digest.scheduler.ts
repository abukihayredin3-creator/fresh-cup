import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { UserRole } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";
import { EmbeddingBackfillWorker } from "../workers/embedding-backfill.worker";
import { KnowledgeBaseIndexWorker } from "../workers/knowledge-base-index.worker";

/** ADMIN bypasses branch-scoping (see common/access/branch-access.util.ts) — the correct scope for a background job with no human operator. */
const SYSTEM_ACTOR: RequestUser = { id: "system", role: UserRole.ADMIN, branchId: null };

/**
 * Nightly job: writes an executive daily-summary memory entry per branch
 * (plus the all-branches aggregate) and backfills any un-indexed memory
 * entries into the vector store. Runs at 3 AM, after Phase 6's forecast
 * regeneration at 2 AM (forecasting/forecasting.scheduler.ts) so the day's
 * forecast is already fresh when the summary reads it.
 */
@Injectable()
export class AiDailyDigestScheduler {
  private readonly logger = new Logger(AiDailyDigestScheduler.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly executiveAi: ExecutiveAiService,
    private readonly embeddingBackfill: EmbeddingBackfillWorker,
    private readonly knowledgeBaseIndex: KnowledgeBaseIndexWorker,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (!this.config.get("AI_EXECUTIVE_ENABLED", { infer: true })) return;

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    for (const branch of [...branches, { id: undefined }]) {
      try {
        await this.executiveAi.dailySummary(SYSTEM_ACTOR, branch.id);
      } catch (error) {
        this.logger.warn(`Daily digest failed for branch ${branch.id ?? "all"}: ${String(error)}`);
      }
    }

    const backfilled = await this.embeddingBackfill.run();
    if (backfilled > 0) {
      this.logger.log(
        `Backfilled ${backfilled} memory entr${backfilled === 1 ? "y" : "ies"} into the vector store`,
      );
    }

    const knowledgeBackfilled = await this.knowledgeBaseIndex.run();
    if (knowledgeBackfilled > 0) {
      this.logger.log(
        `Backfilled ${knowledgeBackfilled} knowledge document${knowledgeBackfilled === 1 ? "" : "s"} into the vector store`,
      );
    }
  }
}
