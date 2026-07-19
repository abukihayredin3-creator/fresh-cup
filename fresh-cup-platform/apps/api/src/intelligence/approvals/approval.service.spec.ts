import { ApprovalActionType, ApprovalRiskLevel, ApprovalStatus } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ApprovalService } from "./approval.service";
import type { ApprovalExecutorRegistry } from "./approval-executor.registry";
import type { PolicyEngineService } from "../governance/policy-engine.service";

const ACTOR: RequestUser = { id: "manager-1", role: "MANAGER" as never, branchId: "b1" };

describe("ApprovalService", () => {
  function makeService() {
    const prisma = {
      aiApprovalRequest: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "req-1", status: ApprovalStatus.PENDING, ...data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "req-1", ...data })),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const executors = {
      execute: jest.fn().mockResolvedValue({ executed: true, note: "done" }),
    } as unknown as jest.Mocked<ApprovalExecutorRegistry>;
    const policyEngine = {
      evaluate: jest.fn().mockReturnValue({ blocked: false }),
    } as unknown as jest.Mocked<PolicyEngineService>;
    const service = new ApprovalService(prisma, executors, policyEngine);
    return { service, prisma, executors, policyEngine };
  }

  it("creates a PENDING request via request()", async () => {
    const { service, prisma } = makeService();
    const request = await service.request({
      actionType: ApprovalActionType.INVENTORY_PURCHASE_ORDER,
      riskLevel: ApprovalRiskLevel.MEDIUM,
      summary: "Reorder low-stock ingredients",
      payload: { branchId: "b1" },
      requestedByAgent: "workflow:low-stock-reorder",
    });
    expect(request.status).toBe(ApprovalStatus.PENDING);
    expect(prisma.aiApprovalRequest.create).toHaveBeenCalled();
  });

  it("approve() rejects a non-pending request", async () => {
    const { service, prisma } = makeService();
    (prisma.aiApprovalRequest.findUnique as jest.Mock).mockResolvedValue({
      id: "req-1",
      status: ApprovalStatus.APPROVED,
    });
    await expect(service.approve("req-1", ACTOR)).rejects.toThrow(/already APPROVED/);
  });

  it("approve() executes the action and marks APPROVED", async () => {
    const { service, prisma, executors } = makeService();
    (prisma.aiApprovalRequest.findUnique as jest.Mock).mockResolvedValue({
      id: "req-1",
      status: ApprovalStatus.PENDING,
      actionType: ApprovalActionType.DISCOUNT,
      payload: { code: "SAVE10" },
    });

    const result = await service.approve("req-1", ACTOR, "looks good");

    expect(executors.execute).toHaveBeenCalledWith(
      ApprovalActionType.DISCOUNT,
      { code: "SAVE10" },
      ACTOR,
    );
    expect(result.executionNote).toBe("done");
    expect(prisma.aiApprovalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ApprovalStatus.APPROVED,
          reviewedByUserId: ACTOR.id,
          reviewNotes: "looks good",
        }),
      }),
    );
  });

  it("reject() rejects a non-pending request and never calls the executor", async () => {
    const { service, prisma, executors } = makeService();
    (prisma.aiApprovalRequest.findUnique as jest.Mock).mockResolvedValue({
      id: "req-1",
      status: ApprovalStatus.REJECTED,
    });
    await expect(service.reject("req-1", ACTOR)).rejects.toThrow(/already REJECTED/);
    expect(executors.execute).not.toHaveBeenCalled();
  });

  it("reject() marks REJECTED without executing", async () => {
    const { service, prisma, executors } = makeService();
    (prisma.aiApprovalRequest.findUnique as jest.Mock).mockResolvedValue({
      id: "req-1",
      status: ApprovalStatus.PENDING,
    });
    await service.reject("req-1", ACTOR, "not now");
    expect(executors.execute).not.toHaveBeenCalled();
    expect(prisma.aiApprovalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ApprovalStatus.REJECTED, reviewNotes: "not now" }),
      }),
    );
  });

  it("request() throws when the policy engine blocks the action", async () => {
    const { service, prisma, policyEngine } = makeService();
    (policyEngine.evaluate as jest.Mock).mockReturnValue({
      blocked: true,
      reason: "too risky",
    });

    await expect(
      service.request({
        actionType: ApprovalActionType.DISCOUNT,
        riskLevel: ApprovalRiskLevel.MEDIUM,
        summary: "80% off everything",
        payload: { value: 80 },
        requestedByAgent: "test",
      }),
    ).rejects.toThrow("too risky");
    expect(prisma.aiApprovalRequest.create).not.toHaveBeenCalled();
  });

  it("request() escalates riskLevel when the policy engine flags it, without blocking", async () => {
    const { service, prisma, policyEngine } = makeService();
    (policyEngine.evaluate as jest.Mock).mockReturnValue({
      blocked: false,
      escalateTo: ApprovalRiskLevel.CRITICAL,
    });

    await service.request({
      actionType: ApprovalActionType.INVENTORY_PURCHASE_ORDER,
      riskLevel: ApprovalRiskLevel.MEDIUM,
      summary: "Large reorder",
      payload: {},
      requestedByAgent: "test",
    });

    expect(prisma.aiApprovalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ riskLevel: ApprovalRiskLevel.CRITICAL }),
      }),
    );
  });

  it("findByIdOrThrow throws NotFoundException when missing", async () => {
    const { service, prisma } = makeService();
    (prisma.aiApprovalRequest.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.findByIdOrThrow("missing")).rejects.toThrow("Approval request not found");
  });
});
