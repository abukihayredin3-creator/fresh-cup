import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RetrainingService } from "./retraining.service";

/**
 * Nightly automatic-retraining check, at 4 AM — after Phase 6's forecast
 * regeneration (2 AM, forecasting/forecasting.scheduler.ts) and Phase 11
 * Part 1's AI daily digest (3 AM, scheduler/ai-daily-digest.scheduler.ts),
 * so retraining always sees the freshest forecast snapshots.
 */
@Injectable()
export class RetrainingScheduler {
  private readonly logger = new Logger(RetrainingScheduler.name);

  constructor(private readonly retraining: RetrainingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async run(): Promise<void> {
    const results = await this.retraining.checkAndRetrainAll();
    const retrained = results.filter((r) => r.shouldRetrain);
    if (retrained.length > 0) {
      this.logger.log(
        `Retrained ${retrained.length} model(s): ${retrained.map((r) => r.modelKey).join(", ")}`,
      );
    }
  }
}
