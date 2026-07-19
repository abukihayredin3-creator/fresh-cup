import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ForecastingService } from "./forecasting.service";

/** Nightly retraining/regeneration job — the only scheduled infrastructure Phase 6 adds. */
@Injectable()
export class ForecastingScheduler {
  private readonly logger = new Logger(ForecastingScheduler.name);

  constructor(private readonly forecastingService: ForecastingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleNightlyForecastRefresh(): Promise<void> {
    this.logger.log("Starting nightly forecast regeneration");
    try {
      await this.forecastingService.regenerateAll();
    } catch (error) {
      this.logger.error(
        "Nightly forecast regeneration failed",
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
