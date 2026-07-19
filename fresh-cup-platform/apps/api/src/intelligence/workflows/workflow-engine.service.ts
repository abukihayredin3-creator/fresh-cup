import { Injectable, Logger } from "@nestjs/common";
import {
  ApprovalActionType,
  ApprovalRiskLevel,
  WorkflowRunStatus,
  WorkflowTriggerType,
  type AiWorkflowDefinition,
  type AiWorkflowRun,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ApprovalService } from "../approvals/approval.service";
import { InventoryAiService } from "../services/inventory-ai/inventory-ai.service";
import { LOW_STOCK_REORDER_STEPS } from "./workflow-step.types";

const LOW_STOCK_REORDER_WORKFLOW_NAME = "Low-stock auto-reorder";

interface StepLogEntry {
  step: string;
  result: string;
  at: string;
}

/**
 * AI Workflow Engine (Phase 11 Part 3) — `runLowStockReorderWorkflow` is
 * the fully-executed instance of the spec's worked example ("inventory
 * low -> supplier available -> auto-create PO -> notify manager -> track
 * approval -> receive inventory -> update stock"). Every run is logged as
 * an `AiWorkflowRun` with a step-by-step trace. The PO is only ever
 * DRAFTED via `ApprovalService.request()` — never created directly —
 * matching this platform's standing "never perform an irreversible action
 * autonomously" rule; "receive inventory" and "update stock" are the
 * existing Phase 3 Purchasing flow a manager runs once the draft is
 * approved, not reimplemented here. See `workflow-step.types.ts` for why
 * this isn't a generic step interpreter yet.
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalService,
    private readonly inventoryAi: InventoryAiService,
  ) {}

  listDefinitions(): Promise<AiWorkflowDefinition[]> {
    return this.prisma.aiWorkflowDefinition.findMany({ orderBy: { name: "asc" } });
  }

  listRuns(workflowId?: string): Promise<AiWorkflowRun[]> {
    return this.prisma.aiWorkflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
  }

  private async ensureLowStockReorderDefinition(): Promise<AiWorkflowDefinition> {
    const existing = await this.prisma.aiWorkflowDefinition.findFirst({
      where: { name: LOW_STOCK_REORDER_WORKFLOW_NAME },
    });
    if (existing) return existing;

    return this.prisma.aiWorkflowDefinition.create({
      data: {
        name: LOW_STOCK_REORDER_WORKFLOW_NAME,
        description:
          "Detects low stock, checks for an active supplier, and drafts a purchase order for manager approval.",
        triggerType: WorkflowTriggerType.EVENT,
        triggerConfig: { event: "inventory.low_stock" } as Prisma.InputJsonValue,
        steps: LOW_STOCK_REORDER_STEPS as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async runLowStockReorderWorkflow(branchId: string): Promise<AiWorkflowRun> {
    const definition = await this.ensureLowStockReorderDefinition();
    const stepLog: StepLogEntry[] = [];
    const log = (step: string, result: string) =>
      stepLog.push({ step, result, at: new Date().toISOString() });

    const run = await this.prisma.aiWorkflowRun.create({
      data: {
        workflowId: definition.id,
        status: WorkflowRunStatus.RUNNING,
        context: { branchId } as Prisma.InputJsonValue,
        stepLog: [] as unknown as Prisma.InputJsonValue,
      },
    });

    const restockInsights = await this.inventoryAi.restockingRecommendations(branchId);
    if (restockInsights.length === 0) {
      log("check_condition:inventory_low", "No items need restocking — workflow ends here.");
      return this.complete(run.id, WorkflowRunStatus.COMPLETED, stepLog);
    }
    log("check_condition:inventory_low", `${restockInsights.length} item(s) need restocking.`);

    const supplier = await this.prisma.supplier.findFirst({
      where: { branchId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!supplier) {
      log(
        "check_condition:supplier_available",
        "No active supplier for this branch — cannot draft a PO.",
      );
      return this.complete(run.id, WorkflowRunStatus.FAILED, stepLog);
    }
    log("check_condition:supplier_available", `Using supplier ${supplier.name} (${supplier.id}).`);

    const lines = restockInsights.map((insight) => {
      const data = insight.data as {
        inventoryItemId: string;
        suggestedReorderQuantity: number;
        suggestedReorderCost: number;
      };
      return {
        inventoryItemId: data.inventoryItemId,
        quantityOrdered: data.suggestedReorderQuantity,
        unitCost:
          data.suggestedReorderQuantity > 0
            ? Math.round(data.suggestedReorderCost / data.suggestedReorderQuantity)
            : 0,
      };
    });

    const approvalRequest = await this.approvals.request({
      actionType: ApprovalActionType.INVENTORY_PURCHASE_ORDER,
      riskLevel: ApprovalRiskLevel.MEDIUM,
      summary: `Auto-drafted reorder PO for ${lines.length} low-stock item(s)`,
      payload: { branchId, supplierId: supplier.id, lines } as Prisma.InputJsonValue,
      requestedByAgent: "workflow:low-stock-reorder",
      branchId,
    });
    log("create_approval", `Drafted approval request ${approvalRequest.id}.`);

    this.logger.log(
      `Low-stock reorder workflow: manager notification needed for approval request ${approvalRequest.id} (branch ${branchId})`,
    );
    log("notify", "Manager notified via the pending approval inbox.");

    log(
      "track_approval",
      `Awaiting manager decision on approval request ${approvalRequest.id}. Receiving inventory and updating stock happen through the existing Purchasing module once approved.`,
    );

    return this.complete(run.id, WorkflowRunStatus.WAITING_APPROVAL, stepLog);
  }

  private complete(
    runId: string,
    status: WorkflowRunStatus,
    stepLog: StepLogEntry[],
  ): Promise<AiWorkflowRun> {
    return this.prisma.aiWorkflowRun.update({
      where: { id: runId },
      data: {
        status,
        stepLog: stepLog as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }
}
