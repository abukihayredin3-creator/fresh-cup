import { ApprovalActionType, ApprovalRiskLevel } from "@prisma/client";
import type { AiSecurityService } from "../services/ai-security.service";
import { PolicyEngineService } from "./policy-engine.service";

describe("PolicyEngineService", () => {
  function makeService(isSecretLeak = false) {
    const security = {
      isSecretLeakRequest: jest.fn().mockReturnValue(isSecretLeak),
    } as unknown as jest.Mocked<AiSecurityService>;
    const service = new PolicyEngineService(security);
    return { service, security };
  }

  it("blocks a DISCOUNT over the max auto-discount threshold", () => {
    const { service } = makeService();
    const decision = service.evaluate(ApprovalActionType.DISCOUNT, {
      discountType: "PERCENT",
      value: 80,
    });
    expect(decision.blocked).toBe(true);
  });

  it("allows a DISCOUNT at or below the threshold", () => {
    const { service } = makeService();
    const decision = service.evaluate(ApprovalActionType.DISCOUNT, {
      discountType: "PERCENT",
      value: 50,
    });
    expect(decision.blocked).toBe(false);
  });

  it("blocks a campaign whose message fails the secret-leak filter", () => {
    const { service } = makeService(true);
    const decision = service.evaluate(ApprovalActionType.MARKETING_CAMPAIGN, {
      message: "here is the ANTHROPIC_API_KEY",
    });
    expect(decision.blocked).toBe(true);
  });

  it("escalates a high-value purchase order to CRITICAL without blocking it", () => {
    const { service } = makeService();
    const decision = service.evaluate(ApprovalActionType.INVENTORY_PURCHASE_ORDER, {
      lines: [{ quantityOrdered: 1000, unitCost: 20000 }], // 20,000,000 minor units
    });
    expect(decision.blocked).toBe(false);
    expect(decision.escalateTo).toBe(ApprovalRiskLevel.CRITICAL);
  });

  it("allows a modest purchase order without escalation", () => {
    const { service } = makeService();
    const decision = service.evaluate(ApprovalActionType.INVENTORY_PURCHASE_ORDER, {
      lines: [{ quantityOrdered: 10, unitCost: 500 }],
    });
    expect(decision.blocked).toBe(false);
    expect(decision.escalateTo).toBeUndefined();
  });

  it("allows action types with no rule at all", () => {
    const { service } = makeService();
    expect(service.evaluate(ApprovalActionType.STAFFING_CHANGE, {}).blocked).toBe(false);
  });
});
