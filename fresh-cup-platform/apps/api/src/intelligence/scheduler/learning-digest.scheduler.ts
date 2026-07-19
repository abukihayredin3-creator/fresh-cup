import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { UserRole } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import { ExecutiveService } from "../../modules/intelligence/executive/executive.service";
import { AiMemoryService } from "../memory/ai-memory.service";
import { ExplanationService } from "../services/explanation.service";

const SYSTEM_ACTOR: RequestUser = { id: "system", role: UserRole.ADMIN, branchId: null };

type LearningPeriod = "weekly" | "monthly" | "seasonal" | "yearly";

const PERIOD_WINDOW_DAYS: Record<LearningPeriod, number> = {
  weekly: 7,
  monthly: 30,
  seasonal: 90,
  yearly: 365,
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * "Long-term Learning" (Phase 11 Part 3) — distinct from Part 2's
 * `RetrainingService` (which refits the predictive models' weights/
 * dataset lineage). This scheduler doesn't touch any model; it writes a
 * periodic summary of what happened into long-term memory
 * (`AiMemoryKind.LEARNING_DIGEST`), at daily/weekly/monthly/seasonal/
 * yearly cadence — "learning" here means the platform's memory/RAG store
 * accumulates a genuine history a manager (or a future LLM-backed
 * question) can recall, not gradient-descent model improvement. The
 * existing `AiDailyDigestScheduler` already covers the daily cadence.
 */
@Injectable()
export class LearningDigestScheduler {
  private readonly logger = new Logger(LearningDigestScheduler.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly executiveService: ExecutiveService,
    private readonly explanation: ExplanationService,
    private readonly memory: AiMemoryService,
  ) {}

  @Cron("0 5 * * 1")
  async runWeekly(): Promise<void> {
    await this.run("weekly");
  }

  @Cron("0 5 1 * *")
  async runMonthly(): Promise<void> {
    await this.run("monthly");
  }

  @Cron("0 5 1 1,4,7,10 *")
  async runSeasonal(): Promise<void> {
    await this.run("seasonal");
  }

  @Cron("0 5 1 1 *")
  async runYearly(): Promise<void> {
    await this.run("yearly");
  }

  async run(period: LearningPeriod): Promise<void> {
    if (!this.config.get("AI_EXECUTIVE_ENABLED", { infer: true })) return;

    const to = new Date();
    const from = new Date(to.getTime() - PERIOD_WINDOW_DAYS[period] * 24 * 60 * 60 * 1000);
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const branch of [...branches, { id: undefined }]) {
      try {
        const overview = await this.executiveService.overview(SYSTEM_ACTOR, {
          branchId: branch.id,
          from: isoDate(from),
          to: isoDate(to),
        });
        const dataPoints = {
          period,
          totalRevenueEtb: overview.totalRevenue / 100,
          totalEstimatedProfitEtb: overview.totalEstimatedProfit / 100,
          repeatCustomerRate: overview.repeatCustomerRate,
          ordersPlaced: overview.conversionMetrics.ordersPlaced,
        };
        const content = await this.explanation.explain(`${period} learning digest`, dataPoints);
        await this.memory.rememberLearningDigest({
          domain: "executive",
          title: `${period[0]!.toUpperCase()}${period.slice(1)} digest — ${isoDate(from)} to ${isoDate(to)}`,
          content,
          metadata: dataPoints,
          branchId: branch.id,
          authorUserId: SYSTEM_ACTOR.id,
        });
      } catch (error) {
        this.logger.warn(
          `${period} learning digest failed for branch ${branch.id ?? "all"}: ${String(error)}`,
        );
      }
    }
  }
}
