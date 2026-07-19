import { Injectable } from "@nestjs/common";
import { ApprovalActionType, ApprovalRiskLevel } from "@prisma/client";
import { AiSecurityService } from "../services/ai-security.service";

export interface PolicyDecision {
  blocked: boolean;
  reason?: string;
  escalateTo?: ApprovalRiskLevel;
}

const MAX_AUTO_DISCOUNT_PERCENT = 50;
const HIGH_VALUE_PO_THRESHOLD_MINOR_UNITS = 10_000_000; // 100,000 ETB

/**
 * AI Governance's policy engine (Phase 11 Part 3) — a small, hand-rolled
 * set of deny/escalate rules evaluated by `ApprovalService.request()`
 * before ANY approval draft is written, so a runaway or malicious agent
 * can't even get a discount/campaign in front of a manager for one-click
 * approval if it's outside these bounds. This is intentionally a fixed
 * rule list, not a configurable policy DSL — the same "don't build a
 * generic unsafe interpreter" reasoning as the Workflow Engine.
 */
@Injectable()
export class PolicyEngineService {
  constructor(private readonly security: AiSecurityService) {}

  evaluate(actionType: ApprovalActionType, payload: unknown): PolicyDecision {
    const data = (payload ?? {}) as Record<string, unknown>;

    if (actionType === ApprovalActionType.DISCOUNT) {
      const value = typeof data.value === "number" ? data.value : 0;
      const discountType = data.discountType;
      if (discountType === "PERCENT" && value > MAX_AUTO_DISCOUNT_PERCENT) {
        return {
          blocked: true,
          reason: `Discounts over ${MAX_AUTO_DISCOUNT_PERCENT}% cannot be AI-drafted — create it manually.`,
        };
      }
    }

    if (
      actionType === ApprovalActionType.MARKETING_CAMPAIGN ||
      actionType === ApprovalActionType.PROMOTION
    ) {
      const message = typeof data.message === "string" ? data.message : "";
      if (message && this.security.isSecretLeakRequest(message)) {
        return { blocked: true, reason: "Campaign message failed the secret-leak safety filter." };
      }
    }

    if (actionType === ApprovalActionType.INVENTORY_PURCHASE_ORDER) {
      const lines = Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]) : [];
      const totalMinorUnits = lines.reduce((sum, line) => {
        const qty = typeof line.quantityOrdered === "number" ? line.quantityOrdered : 0;
        const cost = typeof line.unitCost === "number" ? line.unitCost : 0;
        return sum + qty * cost;
      }, 0);
      if (totalMinorUnits > HIGH_VALUE_PO_THRESHOLD_MINOR_UNITS) {
        return {
          blocked: false,
          escalateTo: ApprovalRiskLevel.CRITICAL,
          reason:
            "Purchase order value exceeds the high-value threshold — escalated for extra scrutiny.",
        };
      }
    }

    return { blocked: false };
  }
}
