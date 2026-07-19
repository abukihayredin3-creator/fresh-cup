import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { WorkforceAiService } from "../services/workforce-ai/workforce-ai.service";

/** MANAGER/ADMIN only — attendance and performance data is HR-sensitive, unlike the other AI domains. */
@ApiTags("ai-workforce")
@Controller("admin/ai/workforce")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class WorkforceAiController {
  constructor(private readonly workforceAi: WorkforceAiService) {}

  @Get("scheduling-insights")
  @ApiOperation({ summary: "Hours where scheduled staffing doesn't match order volume" })
  @ApiOkResponse({ type: [AiInsightDto] })
  schedulingInsights(@Query("branchId") branchId?: string) {
    return this.workforceAi.schedulingInsights(branchId);
  }

  @Get("attendance-anomalies")
  @ApiOperation({ summary: "No-shows and late clock-ins against scheduled shifts" })
  @ApiOkResponse({ type: [AiInsightDto] })
  attendanceAnomalies(@Query("branchId") branchId?: string) {
    return this.workforceAi.attendanceAnomalies(branchId);
  }

  @Get("performance-trends")
  @ApiOperation({
    summary: "Trailing-30-day vs prior-30-day performance rating trend, per employee",
  })
  @ApiOkResponse({ type: [AiInsightDto] })
  performanceTrends(@Query("branchId") branchId?: string) {
    return this.workforceAi.performanceTrends(branchId);
  }

  @Get("labor-coverage")
  @ApiOperation({
    summary:
      "Orders per scheduled labor hour — coverage efficiency, not a cost figure (no wage data exists)",
  })
  @ApiOkResponse({ type: [AiInsightDto] })
  laborCostOptimization(@Query("branchId") branchId?: string) {
    return this.workforceAi.laborCostOptimization(branchId);
  }
}
