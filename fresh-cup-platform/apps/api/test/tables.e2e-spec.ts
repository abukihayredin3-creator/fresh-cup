import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import { createTestBranch, createTestUser, loginAs, TEST_PASSWORD } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Tables (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a table with a generated QR token and resolves it publicly", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, label: "T-9" })
      .expect(201);

    expect(created.body.qrToken).toEqual(expect.any(String));
    expect(created.body.qrToken.length).toBeGreaterThan(20);

    const resolved = await request(app.getHttpServer())
      .get(`/api/v1/tables/${created.body.qrToken}`)
      .expect(200);

    expect(resolved.body).toMatchObject({
      tableId: created.body.id,
      tableLabel: "T-9",
      branchId: branch.id,
    });
  });

  it("404s for an unknown QR token", async () => {
    await request(app.getHttpServer()).get("/api/v1/tables/not-a-real-token").expect(404);
  });

  it("regenerating the QR token invalidates the old one", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, label: "T-1" })
      .expect(201);
    const oldToken = created.body.qrToken as string;

    const regenerated = await request(app.getHttpServer())
      .post(`/api/v1/admin/tables/${created.body.id}/regenerate-qr`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    expect(regenerated.body.qrToken).not.toBe(oldToken);
    await request(app.getHttpServer()).get(`/api/v1/tables/${oldToken}`).expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/tables/${regenerated.body.qrToken}`)
      .expect(200);
  });

  it("a deactivated table no longer resolves", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, label: "T-2" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tables/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer()).get(`/api/v1/tables/${created.body.qrToken}`).expect(404);
  });
});
