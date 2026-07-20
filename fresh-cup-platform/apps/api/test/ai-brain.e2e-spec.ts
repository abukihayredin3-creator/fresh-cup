import type { INestApplication } from "@nestjs/common";
import { InventoryUnit } from "@prisma/client";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import {
  createTestBranch,
  createTestUser,
  loginAs,
  TEST_PASSWORD,
  uniqueSuffix,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("AI Brain (e2e)", () => {
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

  it("returns a zeroed status overview scoped to the caller's own organization", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const orgId = (await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .organizationId;

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-brain/status")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.organizationId).toBe(orgId);
    expect(typeof response.body.predictionProvider).toBe("string");
  });

  it("rejects access from a role below manager", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .get("/api/v1/ai-brain/status")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("analyzes real low-stock inventory into a persisted, org-scoped AiInsight", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const orgId = (await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .organizationId;

    await prisma.inventoryItem.create({
      data: {
        branchId: branch.id,
        name: `Avocado ${uniqueSuffix()}`,
        unit: InventoryUnit.UNIT,
        currentStock: 1,
        reorderThreshold: 10,
        unitCost: 500,
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/v1/ai-brain/analyze")
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "inventory", branchId: branch.id })
      .expect(201);

    expect(response.body.category).toBe("inventory");
    expect(response.body.organizationId).toBe(orgId);
    expect(response.body.content.causes.length).toBeGreaterThan(0);

    const stored = await prisma.aiInsight.findUnique({ where: { id: response.body.id } });
    expect(stored?.organizationId).toBe(orgId);

    // Fire-and-forget audit write — give the interceptor's tap() a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "AiInsight", entityId: response.body.id },
    });
    expect(log).not.toBeNull();
  });

  it("never returns another organization's memory, even when queried without a branch filter", async () => {
    const branchA = await createTestBranch(prisma);
    const { email: emailA } = await createTestUser(prisma, "ADMIN", branchA.id);
    const tokenA = await loginAs(app, emailA, TEST_PASSWORD);
    const orgA = (await prisma.branch.findUniqueOrThrow({ where: { id: branchA.id } }))
      .organizationId;

    await prisma.aiMemory.create({
      data: {
        organizationId: orgA,
        memoryType: "SALES_DROP",
        data: { note: "org A only" },
        importance: 0.9,
      },
    });

    const { token: tokenB } = await createOtherTenantAdmin();

    const responseB = await request(app.getHttpServer())
      .get("/api/v1/ai-brain/memory")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    expect(responseB.body.items).toEqual([]);

    const responseA = await request(app.getHttpServer())
      .get("/api/v1/ai-brain/memory")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(
      responseA.body.items.some((m: { organizationId: string }) => m.organizationId === orgA),
    ).toBe(true);
  });

  it("rejects a cross-organization x-organization-id override", async () => {
    const branchA = await createTestBranch(prisma);
    const { email: emailA } = await createTestUser(prisma, "ADMIN", branchA.id);
    const tokenA = await loginAs(app, emailA, TEST_PASSWORD);
    const orgA = (await prisma.branch.findUniqueOrThrow({ where: { id: branchA.id } }))
      .organizationId;

    await request(app.getHttpServer())
      .get("/api/v1/ai-brain/status")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-organization-id", orgA) // matches the caller's own org — allowed
      .expect(200);

    const { organization: orgB } = await createOtherTenantAdmin();

    await request(app.getHttpServer())
      .get("/api/v1/ai-brain/status")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-organization-id", orgB.id) // a branch-scoped user can never override their org
      .expect(403);
  });

  it("404s when asked to analyze a branch that belongs to a different organization", async () => {
    const branchA = await createTestBranch(prisma);
    const { email: emailA } = await createTestUser(prisma, "ADMIN", branchA.id);
    const tokenA = await loginAs(app, emailA, TEST_PASSWORD);
    const { branch: branchB } = await createOtherTenantAdmin();

    await request(app.getHttpServer())
      .post("/api/v1/ai-brain/analyze")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ category: "sales", branchId: branchB.id })
      .expect(404);
  });

  it("generates recommendations and lets a decision request run without error", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await prisma.inventoryItem.create({
      data: {
        branchId: branch.id,
        name: `Milk ${uniqueSuffix()}`,
        unit: InventoryUnit.MILLILITER,
        currentStock: 0,
        reorderThreshold: 20,
        unitCost: 300,
      },
    });

    const recommendResponse = await request(app.getHttpServer())
      .post("/api/v1/ai-brain/recommend")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, categories: ["inventory"] })
      .expect(201);

    expect(Array.isArray(recommendResponse.body)).toBe(true);
    expect(recommendResponse.body.length).toBeGreaterThan(0);
    expect(recommendResponse.body[0].title).toMatch(/reorder/i);

    const decisionResponse = await request(app.getHttpServer())
      .post("/api/v1/ai-brain/decision")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id })
      .expect(201);

    expect(Array.isArray(decisionResponse.body)).toBe(true);
  });

  it("records learning feedback and advances the recommendation's status, scoped to the caller's org", async () => {
    const branchA = await createTestBranch(prisma);
    const { email: emailA } = await createTestUser(prisma, "ADMIN", branchA.id);
    const tokenA = await loginAs(app, emailA, TEST_PASSWORD);
    const orgA = (await prisma.branch.findUniqueOrThrow({ where: { id: branchA.id } }))
      .organizationId;

    const recommendation = await prisma.aiRecommendation.create({
      data: {
        organizationId: orgA,
        branchId: branchA.id,
        title: "Reorder Avocado",
        description: "Low stock",
        impact: "Avoid stockout",
        confidence: 0.8,
      },
    });

    const { token: tokenB } = await createOtherTenantAdmin();
    await request(app.getHttpServer())
      .post("/api/v1/ai-brain/learning")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ recommendationId: recommendation.id, result: "accepted", feedback: {} })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/ai-brain/learning")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        recommendationId: recommendation.id,
        result: "accepted",
        feedback: { note: "worked" },
      })
      .expect(201);

    const updated = await prisma.aiRecommendation.findUniqueOrThrow({
      where: { id: recommendation.id },
    });
    expect(updated.status).toBe("ACCEPTED");
  });
});
