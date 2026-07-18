import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import { createTestBranch, createTestUser, loginAs, TEST_PASSWORD } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Audit logging (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("records an audit log entry for a mutating request on a tagged controller", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/kitchen-stations")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, name: "Juice Bar" })
      .expect(201);

    // Fire-and-forget write — give the interceptor's tap() a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "KitchenStation", entityId: created.body.id },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toMatchObject({
      action: "POST /api/v1/admin/kitchen-stations",
      entityType: "KitchenStation",
      entityId: created.body.id,
    });
    expect(log?.after).toMatchObject({ name: "Juice Bar" });
  });

  it("does not record a GET request even on a tagged controller", async () => {
    const branch = await createTestBranch(prisma);
    const { user, email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .get("/api/v1/admin/kitchen-stations")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    // Scoped to this test's own actor — a global count would flake under
    // parallel e2e workers writing audit logs against the same database.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const entries = await prisma.auditLog.count({ where: { actorUserId: user.id } });
    expect(entries).toBe(0);
  });

  it("exposes the admin read endpoint to admins only", async () => {
    const branch = await createTestBranch(prisma);
    const { email: managerEmail } = await createTestUser(prisma, "MANAGER", branch.id);
    const managerToken = await loginAs(app, managerEmail, TEST_PASSWORD);
    const { email: adminEmail } = await createTestUser(prisma, "ADMIN", null);
    const adminToken = await loginAs(app, adminEmail, TEST_PASSWORD);

    await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);

    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it("filters audit log entries by entityType and entityId", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const { email: adminEmail } = await createTestUser(prisma, "ADMIN", null);
    const adminToken = await loginAs(app, adminEmail, TEST_PASSWORD);

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, name: "Filter Test Supplier" })
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?entityType=Supplier&entityId=${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(filtered.body.items.length).toBeGreaterThanOrEqual(1);
    expect(
      filtered.body.items.every(
        (entry: { entityType: string; entityId: string }) =>
          entry.entityType === "Supplier" && entry.entityId === created.body.id,
      ),
    ).toBe(true);
  });
});
