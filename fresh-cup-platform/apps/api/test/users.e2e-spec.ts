import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import {
  createTestBranch,
  createTestUser,
  loginAs,
  uniqueSuffix,
  TEST_PASSWORD,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Users (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("updates the authenticated user's own profile", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    const updated = await request(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Updated Name", locale: "AM" })
      .expect(200);

    expect(updated.body).toMatchObject({ fullName: "Updated Name", locale: "AM" });
  });

  it("lets an admin create a staff user", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const newStaffEmail = `staff-${uniqueSuffix()}@test.freshcup.dev`;

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: newStaffEmail,
        password: "BrandNewPassword123!",
        fullName: "New Staff",
        role: "STAFF",
        branchId: branch.id,
      })
      .expect(201);

    expect(created.body).toMatchObject({ email: newStaffEmail, role: "STAFF" });

    // The new account can actually log in.
    await loginAs(app, newStaffEmail, "BrandNewPassword123!");
  });

  it("rejects duplicate emails when creating a staff user", async () => {
    const branch = await createTestBranch(prisma);
    const { email: adminEmail } = await createTestUser(prisma, "ADMIN", branch.id);
    const token = await loginAs(app, adminEmail, TEST_PASSWORD);
    const { email: existingEmail } = await createTestUser(prisma, "STAFF", branch.id);

    await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: existingEmail, password: "Whatever123!", fullName: "Dup", role: "STAFF" })
      .expect(409);
  });

  it("prevents a manager from creating staff users (admin only)", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `x-${uniqueSuffix()}@test.freshcup.dev`,
        password: "Whatever123!",
        fullName: "X",
        role: "STAFF",
      })
      .expect(403);
  });

  it("scopes a manager's user list to their own branch", async () => {
    const branchA = await createTestBranch(prisma);
    const branchB = await createTestBranch(prisma);
    const { email: managerEmail } = await createTestUser(prisma, "MANAGER", branchA.id);
    const token = await loginAs(app, managerEmail, TEST_PASSWORD);

    await createTestUser(prisma, "STAFF", branchA.id);
    await createTestUser(prisma, "STAFF", branchB.id);

    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const branchIds = new Set(response.body.items.map((u: { branchId: string }) => u.branchId));
    expect(branchIds.has(branchA.id)).toBe(true);
    expect(branchIds.has(branchB.id)).toBe(false);
  });

  it("prevents a manager from changing a user's role", async () => {
    const branch = await createTestBranch(prisma);
    const { email: managerEmail } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, managerEmail, TEST_PASSWORD);
    const { user: staffUser } = await createTestUser(prisma, "STAFF", branch.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${staffUser.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "ADMIN" })
      .expect(403);
  });

  it("rejects unauthenticated access to /users/me", async () => {
    await request(app.getHttpServer()).get("/api/v1/users/me").expect(401);
  });
});
