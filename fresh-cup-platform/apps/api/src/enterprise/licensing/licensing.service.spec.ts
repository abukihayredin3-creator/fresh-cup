import { ConflictException, NotFoundException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { LicensingService } from "./licensing.service";

describe("LicensingService", () => {
  function makeService(overrides: { plan?: unknown; subscription?: unknown; userCount?: number }) {
    const prisma = {
      subscriptionPlan: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(overrides.plan ?? null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "plan-1", ...data })),
      },
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue(overrides.subscription ?? null),
        upsert: jest
          .fn()
          .mockImplementation(({ create }) => Promise.resolve({ id: "sub-1", ...create })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "sub-1", ...data })),
      },
      user: { count: jest.fn().mockResolvedValue(overrides.userCount ?? 0) },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new LicensingService(prisma), prisma };
  }

  it("throws NotFoundException when subscribing to an unknown plan", async () => {
    const { service } = makeService({ plan: null });
    await expect(service.subscribe("org-1", { planKey: "missing" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("starts a TRIALING subscription for a known plan", async () => {
    const { service } = makeService({ plan: { id: "plan-1", key: "growth" } });
    const subscription = await service.subscribe("org-1", { planKey: "growth", seats: 5 });
    expect(subscription).toMatchObject({
      organizationId: "org-1",
      status: SubscriptionStatus.TRIALING,
      seats: 5,
    });
  });

  it("throws ConflictException for a duplicate plan key", async () => {
    const { service } = makeService({ plan: { id: "plan-1", key: "growth" } });
    await expect(
      service.createPlan({ key: "growth", name: "Growth", features: [] }),
    ).rejects.toThrow(ConflictException);
  });

  it("returns false entitlement when there is no subscription", async () => {
    const { service } = makeService({ subscription: null });
    await expect(service.isEntitled("org-1", "enterprise.sso")).resolves.toBe(false);
  });

  it("returns false entitlement when the subscription is cancelled", async () => {
    const { service } = makeService({
      subscription: {
        status: SubscriptionStatus.CANCELLED,
        plan: { features: ["enterprise.sso"] },
      },
    });
    await expect(service.isEntitled("org-1", "enterprise.sso")).resolves.toBe(false);
  });

  it("returns true entitlement when the active plan includes the feature", async () => {
    const { service } = makeService({
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        plan: { features: ["enterprise.sso", "enterprise.scim"] },
      },
    });
    await expect(service.isEntitled("org-1", "enterprise.sso")).resolves.toBe(true);
  });

  it("reports seat limit usage", async () => {
    const { service } = makeService({ subscription: { seats: 10 }, userCount: 7 });
    await expect(service.checkSeatLimit("org-1")).resolves.toEqual({
      used: 7,
      seats: 10,
      withinLimit: true,
    });
  });

  it("reports being over the seat limit", async () => {
    const { service } = makeService({ subscription: { seats: 3 }, userCount: 5 });
    await expect(service.checkSeatLimit("org-1")).resolves.toEqual({
      used: 5,
      seats: 3,
      withinLimit: false,
    });
  });
});
