import { Controller, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { DriftDetectionService } from "../drift/drift-detection.service";

/** `/ai/drift` from the Phase 11 Part 2 spec's AI API surface. */
@ApiTags("ai-drift")
@Controller("admin/ai/drift")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class DriftController {
  constructor(private readonly drift: DriftDetectionService) {}

  @Get()
  @ApiOperation({
    summary: "List drift alerts, optionally filtered by modelKey and unresolved-only",
  })
  listAlerts(
    @Query("modelKey") modelKey?: string,
    @Query("unresolvedOnly") unresolvedOnly?: string,
  ) {
    return this.drift.listAlerts(modelKey, unresolvedOnly === "true");
  }

  @Post(":id/resolve")
  @ApiOperation({ summary: "Mark a drift alert as resolved" })
  resolve(@Param("id") id: string) {
    return this.drift.resolveAlert(id);
  }
}
