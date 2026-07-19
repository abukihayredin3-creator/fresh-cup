import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalActionType,
  ApprovalRiskLevel,
  ApprovalStatus,
  type AiApprovalRequest,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PolicyEngineService } from "../governance/policy-engine.service";
import { ApprovalExecutorRegistry } from "./approval-executor.registry";

export interface RequestApprovalInput {
  actionType: ApprovalActionType;
  riskLevel: ApprovalRiskLevel;
  summary: string;
  payload: Prisma.InputJsonValue;
  requestedByAgent: string;
  branchId?: string;
}

/**
 * The Human Approval Layer's service — every high-risk/irreversible
 * action this platform's agents, workflows, and automations want to take
 * (refund, delete, discount, promotion, PO, price change) is written as a
 * PENDING `AiApprovalRequest` via `request()`. Only `approve()` moves an
 * action from "drafted" to "actually happened", by delegating to
 * `ApprovalExecutorRegistry` — reject/no-decision never touches
 * production state.
 */
@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executors: ApprovalExecutorRegistry,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  async request(input: RequestApprovalInput): Promise<AiApprovalRequest> {
    const decision = this.policyEngine.evaluate(input.actionType, input.payload);
    if (decision.blocked) {
      throw new ForbiddenException(decision.reason ?? "Blocked by AI governance policy.");
    }
    const riskLevel = decision.escalateTo ?? input.riskLevel;

    return this.prisma.aiApprovalRequest.create({
      data: {
        actionType: input.actionType,
        riskLevel,
        summary: input.summary,
        payload: input.payload,
        requestedByAgent: input.requestedByAgent,
        branchId: input.branchId,
      },
    });
  }

  list(status?: ApprovalStatus, actionType?: ApprovalActionType): Promise<AiApprovalRequest[]> {
    return this.prisma.aiApprovalRequest.findMany({
      where: { status, actionType },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async findByIdOrThrow(id: string): Promise<AiApprovalRequest> {
    const request = await this.prisma.aiApprovalRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException("Approval request not found");
    }
    return request;
  }

  async approve(
    id: string,
    actor: RequestUser,
    notes?: string,
  ): Promise<AiApprovalRequest & { executionNote: string }> {
    const request = await this.findByIdOrThrow(id);
    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Approval request is already ${request.status}`);
    }

    const execution = await this.executors.execute(request.actionType, request.payload, actor);

    const updated = await this.prisma.aiApprovalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        reviewNotes: notes ?? execution.note,
      },
    });

    return { ...updated, executionNote: execution.note };
  }

  async reject(id: string, actor: RequestUser, notes?: string): Promise<AiApprovalRequest> {
    const request = await this.findByIdOrThrow(id);
    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Approval request is already ${request.status}`);
    }
    return this.prisma.aiApprovalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.REJECTED,
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });
  }
}
