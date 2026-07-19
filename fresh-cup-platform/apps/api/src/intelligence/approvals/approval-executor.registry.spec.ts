import { ApprovalActionType } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ApprovalExecutorRegistry } from "./approval-executor.registry";
import type { CampaignsService } from "../../modules/marketing/campaigns/campaigns.service";
import type { MenuItemsService } from "../../modules/catalog/menu-items/menu-items.service";
import type { PaymentsService } from "../../modules/payments/payments.service";
import type { CouponsService } from "../../modules/promotions/coupons/coupons.service";
import type { PurchaseOrdersService } from "../../modules/purchasing/purchase-orders/purchase-orders.service";

const ACTOR: RequestUser = { id: "manager-1", role: "MANAGER" as never, branchId: "b1" };

describe("ApprovalExecutorRegistry", () => {
  function makeRegistry() {
    const purchaseOrders = {
      create: jest.fn().mockResolvedValue({ id: "po-1" }),
    } as unknown as jest.Mocked<PurchaseOrdersService>;
    const coupons = {
      create: jest.fn().mockResolvedValue({ code: "SAVE10" }),
    } as unknown as jest.Mocked<CouponsService>;
    const campaigns = {
      create: jest.fn().mockResolvedValue({ id: "camp-1" }),
    } as unknown as jest.Mocked<CampaignsService>;
    const menuItems = {
      update: jest.fn().mockResolvedValue({ id: "item-1" }),
    } as unknown as jest.Mocked<MenuItemsService>;
    const payments = {
      refund: jest.fn().mockResolvedValue({ id: "pay-1" }),
    } as unknown as jest.Mocked<PaymentsService>;
    const registry = new ApprovalExecutorRegistry(
      purchaseOrders,
      coupons,
      campaigns,
      menuItems,
      payments,
    );
    return { registry, purchaseOrders, coupons, campaigns, menuItems, payments };
  }

  it("executes INVENTORY_PURCHASE_ORDER through PurchaseOrdersService", async () => {
    const { registry, purchaseOrders } = makeRegistry();
    const result = await registry.execute(
      ApprovalActionType.INVENTORY_PURCHASE_ORDER,
      {
        branchId: "11111111-1111-4111-8111-111111111111",
        supplierId: "22222222-2222-4222-8222-222222222222",
        lines: [
          {
            inventoryItemId: "33333333-3333-4333-8333-333333333333",
            quantityOrdered: 10,
            unitCost: 500,
          },
        ],
      },
      ACTOR,
    );
    expect(result.executed).toBe(true);
    expect(purchaseOrders.create).toHaveBeenCalledWith(ACTOR, expect.any(Object));
  });

  it("rejects an invalid INVENTORY_PURCHASE_ORDER payload before calling the service", async () => {
    const { registry, purchaseOrders } = makeRegistry();
    await expect(
      registry.execute(
        ApprovalActionType.INVENTORY_PURCHASE_ORDER,
        { branchId: "not-a-uuid" },
        ACTOR,
      ),
    ).rejects.toThrow(/failed validation/);
    expect(purchaseOrders.create).not.toHaveBeenCalled();
  });

  it("executes DISCOUNT through CouponsService", async () => {
    const { registry, coupons } = makeRegistry();
    const result = await registry.execute(
      ApprovalActionType.DISCOUNT,
      { code: "SAVE10", discountType: "PERCENT", value: 10 },
      ACTOR,
    );
    expect(result.executed).toBe(true);
    expect(coupons.create).toHaveBeenCalled();
  });

  it("executes PROMOTION and MARKETING_CAMPAIGN through CampaignsService", async () => {
    const { registry, campaigns } = makeRegistry();
    const payload = { name: "Rainy Day Juice Push", channel: "EMAIL", message: "Get 10% off" };
    await registry.execute(ApprovalActionType.PROMOTION, payload, ACTOR);
    await registry.execute(ApprovalActionType.MARKETING_CAMPAIGN, payload, ACTOR);
    expect(campaigns.create).toHaveBeenCalledTimes(2);
  });

  it("executes PRICE_CHANGE through MenuItemsService.update", async () => {
    const { registry, menuItems } = makeRegistry();
    const result = await registry.execute(
      ApprovalActionType.PRICE_CHANGE,
      { menuItemId: "item-1", priceEtb: 12000 },
      ACTOR,
    );
    expect(result.executed).toBe(true);
    expect(menuItems.update).toHaveBeenCalledWith(ACTOR, "item-1", expect.any(Object));
  });

  it("executes REFUND through PaymentsService.refund", async () => {
    const { registry, payments } = makeRegistry();
    const result = await registry.execute(ApprovalActionType.REFUND, { paymentId: "pay-1" }, ACTOR);
    expect(result.executed).toBe(true);
    expect(payments.refund).toHaveBeenCalledWith("pay-1");
  });

  it("REFUND without a paymentId throws before calling PaymentsService", async () => {
    const { registry, payments } = makeRegistry();
    await expect(registry.execute(ApprovalActionType.REFUND, {}, ACTOR)).rejects.toThrow(
      "REFUND payload requires paymentId",
    );
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it.each([
    ApprovalActionType.DELETE,
    ApprovalActionType.STAFFING_CHANGE,
    ApprovalActionType.OTHER,
  ])(
    "%s has no automatic executor — records the decision without executing",
    async (actionType) => {
      const { registry } = makeRegistry();
      const result = await registry.execute(actionType, {}, ACTOR);
      expect(result.executed).toBe(false);
      expect(result.note).toMatch(/no automatic executor/);
    },
  );
});
