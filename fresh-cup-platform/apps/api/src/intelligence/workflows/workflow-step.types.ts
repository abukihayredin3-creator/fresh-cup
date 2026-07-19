/**
 * The AI Workflow Engine's step DSL — small, declarative, and stored as
 * JSON on `AiWorkflowDefinition.steps` so a workflow's shape is inspectable
 * without reading code. v1 scope: this platform ships ONE fully-executed
 * workflow (`WorkflowEngineService.runLowStockReorderWorkflow`, matching
 * the Phase 11 Part 3 spec's own worked example) rather than a generic
 * interpreter for arbitrary step graphs — building a safe, sandboxed
 * "if/then" evaluator for admin-authored conditions is a materially
 * different (and riskier) project than the rest of this hand-rolled
 * platform takes on. `AiWorkflowDefinition.steps` for the shipped workflow
 * documents the same steps this code actually runs, so the two never
 * drift silently.
 */
export type WorkflowStepKind = "check_condition" | "create_approval" | "notify" | "track_approval";

export interface WorkflowStepDefinition {
  kind: WorkflowStepKind;
  description: string;
}

export const LOW_STOCK_REORDER_STEPS: WorkflowStepDefinition[] = [
  { kind: "check_condition", description: "Inventory low (suggestedReorderQuantity > 0)" },
  {
    kind: "check_condition",
    description: "Supplier available (an active Supplier for the branch)",
  },
  { kind: "create_approval", description: "Auto-draft a purchase order for approval" },
  { kind: "notify", description: "Notify manager that a PO draft is awaiting approval" },
  {
    kind: "track_approval",
    description:
      "Track approval via the Human Approval Layer — receiving inventory and updating stock happen through the existing Purchasing module once approved (Phase 3), not re-implemented here",
  },
];
