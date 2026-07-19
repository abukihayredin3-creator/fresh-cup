import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { DecisionEngineService } from "./decision-engine.service";

/** The Autonomous Decision Engine — detects issues and builds an action plan, never executes one. */
@ApiTags("ai-decision-engine")
@Controller("admin/ai/decision-engine")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class DecisionEngineController {
  constructor(private readonly decisionEngine: DecisionEngineService) {}

  @Get("sales-drop")
  @ApiOperation({
    summary:
      "Detect a week-over-week sales decline and build reasons + a recommended action plan; null if no significant decline. ?draftApprovals=true writes the recommendations to the Human Approval Layer instead of only returning them.",
  })
  detectSalesDrop(
    @CurrentUser() actor: RequestUser,
    @Query("branchId") branchId?: string,
    @Query("draftApprovals") draftApprovals?: string,
  ) {
    return this.decisionEngine.detectSalesDrop(actor, branchId, draftApprovals === "true");
  }
}
