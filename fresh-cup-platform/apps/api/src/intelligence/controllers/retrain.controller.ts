import { Controller, Get, Param, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { RetrainingService } from "../training/retraining.service";

/**
 * `/ai/retrain` from the Phase 11 Part 2 spec's AI API surface —
 * admin-only: retraining consumes real work (regenerating Phase 6
 * forecasts for sales-* models) and writes a new registry version, so it
 * warrants the same authorization bar as promoting a model to production.
 */
@ApiTags("ai-retrain")
@Controller("admin/ai/retrain")
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class RetrainController {
  constructor(private readonly retraining: RetrainingService) {}

  @Get("check/:modelKey")
  @ApiOperation({
    summary: "Check whether a model needs retraining, and why, without retraining it",
  })
  checkTriggers(@Param("modelKey") modelKey: string) {
    return this.retraining.checkTriggers(modelKey);
  }

  @Post(":modelKey")
  @ApiOperation({ summary: "Manually trigger a retrain for one model now" })
  retrainOne(@Param("modelKey") modelKey: string) {
    return this.retraining.retrain(modelKey, "manual");
  }

  @Post()
  @ApiOperation({
    summary:
      "Check every trainable model and retrain any that need it now, instead of waiting for the nightly job",
  })
  retrainAll() {
    return this.retraining.checkAndRetrainAll();
  }
}
