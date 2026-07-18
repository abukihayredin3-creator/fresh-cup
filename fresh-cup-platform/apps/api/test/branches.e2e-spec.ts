import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import { createTestBranch, createTestUser, loginAs, TEST_PASSWORD } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Branches (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists active branches publicly", async () => {
    const branch = await createTestBranch(prisma);

    const response = await request(app.getHttpServer()).get("/api/v1/branches").expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: branch.id, isActive: true })]),
    );
  });

  it("rejects branch creation from a non-admin", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Branch", addressText: "Somewhere" })
      .expect(403);
  });

  it("lets an admin create and update a branch", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const created = await request(app.getHttpServer())
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bole Branch", addressText: "Bole, Addis Ababa" })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/branches/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    expect(updated.body.isActive).toBe(false);
  });

  it("returns 404 for a nonexistent branch", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/branches/00000000-0000-0000-0000-000000000000")
      .expect(404);
  });
});
