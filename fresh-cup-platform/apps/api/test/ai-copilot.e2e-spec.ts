import type { INestApplication } from "@nestjs/common";
import { InventoryTransactionReason, InventoryUnit } from "@prisma/client";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import {
  createTestBranch,
  createTestCategory,
  createTestMenuItem,
  createTestUser,
  loginAs,
  TEST_PASSWORD,
  uniqueSuffix,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("AI Copilot (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  /** A second, unrelated organization + branch + admin — for cross-tenant isolation checks. */
  async function createOtherTenantAdmin() {
    const organization = await prisma.organization.create({
      data: { name: `Other Org ${uniqueSuffix()}`, slug: `other-org-${uniqueSuffix()}` },
    });
    const branch = await prisma.branch.create({
      data: {
        name: `Other Branch ${uniqueSuffix()}`,
        addressText: "Elsewhere",
        organizationId: organization.id,
      },
    });
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    return { organization, branch, token };
  }

  /** A single paid order with one line item, so revenue/product figures are non-zero. */
  async function seedPaidOrder(branchId: string) {
    const category = await createTestCategory(prisma, branchId);
    const menuItem = await createTestMenuItem(prisma, branchId, category.id, { basePrice: 5000 });
    const { user } = await createTestUser(prisma, "CUSTOMER", null);
    const order = await prisma.order.create({
      data: {
        branchId,
        userId: user.id,
        orderType: "PICKUP",
        status: "COMPLETED",
        subtotal: 5000,
        total: 5000,
        idempotencyKey: `e2e-${uniqueSuffix()}`,
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.nameEn,
        unitPrice: 5000,
        quantity: 1,
        lineTotal: 5000,
        prepTimeSeconds: 60,
      },
    });
    return { menuItem, order };
  }

  it("returns a dashboard payload scoped to the caller's own organization", async () => {
    const branch = await createTestBranch(prisma);
    await seedPaidOrder(branch.id);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId: branch.id })
      .expect(200);

    expect(response.body.overview.totalRevenue).toBeGreaterThanOrEqual(5000);
    expect(response.body.kpis).toBeInstanceOf(Array);
    expect(typeof response.body.healthScore.overallScore).toBe("number");
    expect(Array.isArray(response.body.activeAlerts)).toBe(true);
    expect(Array.isArray(response.body.predictions)).toBe(true);
  });

  it("rejects access from a role below manager", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("generates and persists a morning briefing, and audits the GET request", async () => {
    const branch = await createTestBranch(prisma);
    await seedPaidOrder(branch.id);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const orgId = (await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .organizationId;

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/briefing")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId: branch.id })
      .expect(200);

    expect(response.body.organizationId).toBe(orgId);
    expect(response.body.revenueSummary.currentRevenue).toBeGreaterThanOrEqual(5000);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(response.body.riskLevel);

    const stored = await prisma.executiveBriefing.findUnique({ where: { id: response.body.id } });
    expect(stored?.organizationId).toBe(orgId);

    // Fire-and-forget audit write — give the interceptor's tap() a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "ExecutiveBriefing", entityId: response.body.id },
    });
    expect(log).not.toBeNull();
    expect(log?.action).toBe("GET /api/v1/ai-copilot/briefing");
  });

  it("computes and persists a business health score between 0 and 100", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/health")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId: branch.id })
      .expect(200);

    expect(response.body.overallScore).toBeGreaterThanOrEqual(0);
    expect(response.body.overallScore).toBeLessThanOrEqual(100);
    expect(response.body.trend).toBe("STABLE"); // no prior snapshot yet
  });

  it("detects and persists an inventory-mismatch anomaly from real manual-adjustment transactions", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const item = await prisma.inventoryItem.create({
      data: {
        branchId: branch.id,
        name: `Milk ${uniqueSuffix()}`,
        unit: InventoryUnit.MILLILITER,
        currentStock: 100,
        reorderThreshold: 10,
        unitCost: 50,
      },
    });
    for (let i = 0; i < 3; i++) {
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          delta: "1",
          reason: InventoryTransactionReason.MANUAL_ADJUSTMENT,
        },
      });
    }

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/alerts")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId: branch.id })
      .expect(200);

    expect(response.body.some((a: { type: string }) => a.type === "INVENTORY_MISMATCH")).toBe(true);
  });

  it("returns ranked recommendations", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await prisma.inventoryItem.create({
      data: {
        branchId: branch.id,
        name: `Avocado ${uniqueSuffix()}`,
        unit: InventoryUnit.UNIT,
        currentStock: 1,
        reorderThreshold: 20,
        unitCost: 500,
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/recommendations")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId: branch.id })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it("generates a template-based natural-language summary, respecting the period query param", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/summary")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId: branch.id, period: "day" })
      .expect(200);

    expect(response.body.period).toBe("day");
    expect(typeof response.body.content).toBe("string");
    expect(response.body.content.length).toBeGreaterThan(0);
  });

  it("never leaks another organization's briefing, even scoped to the branch alone", async () => {
    const branchA = await createTestBranch(prisma);
    const { email: emailA } = await createTestUser(prisma, "ADMIN", branchA.id);
    const tokenA = await loginAs(app, emailA, TEST_PASSWORD);
    const { branch: branchB, token: tokenB } = await createOtherTenantAdmin();

    await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/briefing")
      .set("Authorization", `Bearer ${tokenA}`)
      .query({ branchId: branchB.id })
      .expect(404);

    await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/briefing")
      .set("Authorization", `Bearer ${tokenB}`)
      .query({ branchId: branchA.id })
      .expect(404);
  });

  it("rejects a cross-organization x-organization-id override", async () => {
    const branchA = await createTestBranch(prisma);
    const { email: emailA } = await createTestUser(prisma, "ADMIN", branchA.id);
    const tokenA = await loginAs(app, emailA, TEST_PASSWORD);
    const { organization: orgB } = await createOtherTenantAdmin();

    await request(app.getHttpServer())
      .get("/api/v1/ai-copilot/health")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-organization-id", orgB.id)
      .expect(403);
  });
});
