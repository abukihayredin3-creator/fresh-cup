import type { ConfigService } from "@nestjs/config";
import { LoyaltyReason } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { OrderPaidEvent } from "../../common/events/order-events";
import type { PrismaService } from "../../database/prisma.service";
import { LoyaltyService } from "./loyalty.service";

describe("LoyaltyService.handleOrderPaid", () => {
  let service: LoyaltyService;
  let prisma: {
    loyaltyLedger: { findFirst: jest.Mock; create: jest.Mock };
  };
  let config: { get: jest.Mock };

  const event: OrderPaidEvent = {
    orderId: "order-1",
    branchId: "branch-1",
    userId: "user-1",
    total: 25500,
    currency: "ETB",
  };

  beforeEach(() => {
    prisma = {
      loyaltyLedger: { findFirst: jest.fn(), create: jest.fn() },
    };
    config = { get: jest.fn().mockReturnValue(1000) }; // 1 point per 10 ETB
    service = new LoyaltyService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  it("accrues floor(total / unitsPerPoint) points on top of the existing balance", async () => {
    prisma.loyaltyLedger.findFirst
      .mockResolvedValueOnce(null) // no existing accrual for this order
      .mockResolvedValueOnce({ balanceAfter: 40 }); // current balance lookup inside accrue()

    await service.handleOrderPaid(event);

    expect(prisma.loyaltyLedger.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        orderId: "order-1",
        pointsDelta: 25, // floor(25500 / 1000)
        reason: LoyaltyReason.ORDER_EARNED,
        balanceAfter: 65,
      },
    });
  });

  it("is idempotent against a duplicate event for the same order", async () => {
    prisma.loyaltyLedger.findFirst.mockResolvedValueOnce({ id: "existing-entry" });

    await service.handleOrderPaid(event);

    expect(prisma.loyaltyLedger.create).not.toHaveBeenCalled();
  });

  it("skips accrual when the order total earns fewer than 1 point", async () => {
    prisma.loyaltyLedger.findFirst.mockResolvedValueOnce(null);

    await service.handleOrderPaid({ ...event, total: 500 });

    expect(prisma.loyaltyLedger.create).not.toHaveBeenCalled();
  });
});
