import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { DecideOutcomeDto } from "./dto/decide-outcome.dto";
import { RecordMetricDto } from "./dto/record-metric.dto";
import { RecordOutcomeDto } from "./dto/record-outcome.dto";
import { EvaluationTrackerService } from "./evaluation-tracker.service";

/** Continuous Evaluation — accuracy/latency/etc. time series + recommendation acceptance tracking. */
@ApiTags("ai-evaluations")
@Controller("admin/ai/evaluations")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class EvaluationTrackerController {
  constructor(private readonly evaluations: EvaluationTrackerService) {}

  @Post()
  @ApiOperation({ summary: "Log a metric measurement (accuracy/precision/recall/latency/...)" })
  record(@Body() dto: RecordMetricDto) {
    return this.evaluations.record(dto);
  }

  @Get()
  @ApiOperation({ summary: "Fetch a metric's recent history" })
  trend(
    @Query("metricName") metricName: string,
    @Query("modelKey") modelKey?: string,
    @Query("limit") limit?: string,
  ) {
    return this.evaluations.trend(metricName, modelKey, limit ? Number(limit) : undefined);
  }

  @Post("recommendations")
  @ApiOperation({ summary: "Log a recommendation as PENDING a human decision" })
  recordOutcome(@Body() dto: RecordOutcomeDto) {
    return this.evaluations.recordOutcome(dto);
  }

  @Post("recommendations/:id/decide")
  @ApiOperation({
    summary: "Record whether a manager accepted, rejected, or ignored the recommendation",
  })
  decideOutcome(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: DecideOutcomeDto,
  ) {
    return this.evaluations.decideOutcome(id, dto.status, actor.id, dto.actualImpact);
  }

  @Post("recommendations/:id/flag-hallucination")
  @ApiOperation({
    summary: "Manually flag a recommendation as unfounded (no automatic detector exists)",
  })
  flagHallucination(@Param("id") id: string) {
    return this.evaluations.flagHallucination(id);
  }

  @Get("acceptance-rate")
  @ApiOperation({ summary: "Recommendation acceptance rate, optionally filtered by source" })
  acceptanceRate(@Query("source") source?: string) {
    return this.evaluations.acceptanceRate(source);
  }

  @Get("business-impact")
  @ApiOperation({ summary: "Estimated vs. actual impact of accepted recommendations" })
  businessImpact(@Query("source") source?: string) {
    return this.evaluations.businessImpact(source);
  }
}
