import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ApprovalActionType,
  ApprovalRiskLevel,
  ApprovalStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { ApprovalService } from "./approval.service";
import { CreateApprovalRequestDto } from "./dto/create-approval-request.dto";
import { DecideApprovalDto } from "./dto/decide-approval.dto";

/** The Human Approval Layer — Phase 11 Part 3's "high-risk actions need approval" requirement. */
@ApiTags("ai-approvals")
@Controller("admin/ai/approvals")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get()
  @ApiOperation({ summary: "List AI-drafted approval requests, optionally filtered" })
  list(
    @Query("status") status?: ApprovalStatus,
    @Query("actionType") actionType?: ApprovalActionType,
  ) {
    return this.approvals.list(status, actionType);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch one approval request" })
  findOne(@Param("id") id: string) {
    return this.approvals.findByIdOrThrow(id);
  }

  @Post()
  @ApiOperation({
    summary:
      "Manually record a high-risk action for approval (usually created by agents/workflows instead)",
  })
  create(@Body() dto: CreateApprovalRequestDto) {
    return this.approvals.request({
      actionType: dto.actionType,
      riskLevel: dto.riskLevel ?? ApprovalRiskLevel.MEDIUM,
      summary: dto.summary,
      payload: dto.payload as Prisma.InputJsonValue,
      requestedByAgent: "manual",
      branchId: dto.branchId,
    });
  }

  @Post(":id/approve")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Approve and execute the drafted action (admin only) — the only endpoint that turns an AI draft into a real write",
  })
  approve(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.approve(id, actor, dto.notes);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a drafted action — no write ever happens" })
  reject(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.reject(id, actor, dto.notes);
  }
}
