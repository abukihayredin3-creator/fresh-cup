import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";

@ApiTags("ai-executive")
@Controller("admin/ai/executive")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class ExecutiveAiController {
  constructor(private readonly executiveAi: ExecutiveAiService) {}

  @Get("daily-summary")
  @ApiOperation({ summary: "Explained, confidence-scored summary of today's business performance" })
  @ApiOkResponse({ type: AiInsightDto })
  dailySummary(@CurrentUser() actor: RequestUser, @Query("branchId") branchId?: string) {
    return this.executiveAi.dailySummary(actor, branchId);
  }

  @Get("weekly-report")
  @ApiOperation({ summary: "Explained, confidence-scored summary of the trailing 7 days" })
  @ApiOkResponse({ type: AiInsightDto })
  weeklyReport(@CurrentUser() actor: RequestUser, @Query("branchId") branchId?: string) {
    return this.executiveAi.weeklyReport(actor, branchId);
  }

  @Get("revenue-explanation")
  @ApiOperation({ summary: "Natural-language explanation of the current revenue trend direction" })
  @ApiOkResponse({ type: AiInsightDto })
  revenueExplanation(@CurrentUser() actor: RequestUser, @Query("branchId") branchId?: string) {
    return this.executiveAi.revenueExplanation(actor, branchId);
  }

  @Get("risks")
  @ApiOperation({
    summary: "Detected operational risks: revenue decline, inventory waste, low repeat rate",
  })
  @ApiOkResponse({ type: [AiInsightDto] })
  riskDetection(@CurrentUser() actor: RequestUser, @Query("branchId") branchId?: string) {
    return this.executiveAi.riskDetection(actor, branchId);
  }

  @Get("growth-opportunities")
  @ApiOperation({
    summary: "Segment-targeted growth opportunities, drawn from marketing intelligence",
  })
  @ApiOkResponse({ type: [AiInsightDto] })
  growthOpportunities(@CurrentUser() actor: RequestUser) {
    return this.executiveAi.growthOpportunities(actor);
  }
}
