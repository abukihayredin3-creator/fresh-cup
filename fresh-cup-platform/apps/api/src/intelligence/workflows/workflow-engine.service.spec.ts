import { WorkflowRunStatus } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { ApprovalService } from "../approvals/approval.service";
import type { InventoryAiService } from "../services/inventory-ai/inventory-ai.service";
import { WorkflowEngineService } from "./workflow-engine.service";

describe("WorkflowEngineService", () => {
  function makeService() {
    const prisma = {
      aiWorkflowDefinition: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "def-1" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aiWorkflowRun: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "run-1", ...data })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "run-1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      supplier: { findFirst: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;
    const approvals = {
      request: jest.fn().mockResolvedValue({ id: "approval-1" }),
    } as unknown as jest.Mocked<ApprovalService>;
    const inventoryAi = {
      restockingRecommendations: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<InventoryAiService>;
    const service = new WorkflowEngineService(prisma, approvals, inventoryAi);
    return { service, prisma, approvals, inventoryAi };
  }

  it("completes with no draft when nothing needs restocking", async () => {
    const { service, prisma, approvals } = makeService();
    const run = await service.runLowStockReorderWorkflow("b1");

    expect(approvals.request).not.toHaveBeenCalled();
    expect(prisma.aiWorkflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WorkflowRunStatus.COMPLETED }),
      }),
    );
    expect(run.status).toBe(WorkflowRunStatus.COMPLETED);
  });

  it("fails the run when no active supplier exists for the branch", async () => {
    const { service, prisma, inventoryAi, approvals } = makeService();
    (inventoryAi.restockingRecommendations as jest.Mock).mockResolvedValue([
      {
        title: "Restock: Oranges",
        explanation: "e",
        confidence: 0.5,
        data: { inventoryItemId: "i1", suggestedReorderQuantity: 10, suggestedReorderCost: 5000 },
      },
    ]);
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

    const run = await service.runLowStockReorderWorkflow("b1");

    expect(approvals.request).not.toHaveBeenCalled();
    expect(run.status).toBe(WorkflowRunStatus.FAILED);
  });

  it("drafts a PO approval request and ends WAITING_APPROVAL when everything checks out", async () => {
    const { service, prisma, inventoryAi, approvals } = makeService();
    (inventoryAi.restockingRecommendations as jest.Mock).mockResolvedValue([
      {
        title: "Restock: Oranges",
        explanation: "e",
        confidence: 0.5,
        data: { inventoryItemId: "i1", suggestedReorderQuantity: 10, suggestedReorderCost: 5000 },
      },
    ]);
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({
      id: "sup-1",
      name: "Fresh Farms",
    });

    const run = await service.runLowStockReorderWorkflow("b1");

    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "INVENTORY_PURCHASE_ORDER",
        requestedByAgent: "workflow:low-stock-reorder",
        branchId: "b1",
      }),
    );
    expect(run.status).toBe(WorkflowRunStatus.WAITING_APPROVAL);
  });

  it("reuses an existing workflow definition rather than creating a duplicate", async () => {
    const { service, prisma } = makeService();
    (prisma.aiWorkflowDefinition.findFirst as jest.Mock).mockResolvedValue({ id: "existing-def" });

    await service.runLowStockReorderWorkflow("b1");

    expect(prisma.aiWorkflowDefinition.create).not.toHaveBeenCalled();
  });
});
