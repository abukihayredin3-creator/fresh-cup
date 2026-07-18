import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import {
  createTestBranch,
  createTestCategory,
  createTestMenuItem,
  createTestUser,
  loginAs,
  TEST_PASSWORD,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Modifiers (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupManager() {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    return { branch, token };
  }

  it("creates a modifier group with options and attaches it to a menu item", async () => {
    const { branch, token } = await setupManager();
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id);

    const group = await request(app.getHttpServer())
      .post("/api/v1/admin/modifier-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        nameEn: "Size",
        selectionType: "SINGLE",
        minSelect: 1,
        maxSelect: 1,
      })
      .expect(201);

    const option = await request(app.getHttpServer())
      .post(`/api/v1/admin/modifier-groups/${group.body.id}/options`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nameEn: "Large", priceDelta: 2000 })
      .expect(201);

    const link = await request(app.getHttpServer())
      .post(`/api/v1/admin/menu-items/${menuItem.id}/modifier-groups`)
      .set("Authorization", `Bearer ${token}`)
      .send({ modifierGroupId: group.body.id, isRequired: true })
      .expect(201);

    expect(link.body).toMatchObject({ modifierGroupId: group.body.id, isRequired: true });

    const publicItem = await request(app.getHttpServer())
      .get(`/api/v1/menu-items/${menuItem.id}`)
      .expect(200);

    expect(publicItem.body.modifierGroups).toHaveLength(1);
    expect(publicItem.body.modifierGroups[0]).toMatchObject({
      nameEn: "Size",
      isRequired: true,
      selectionType: "SINGLE",
    });
    expect(publicItem.body.modifierGroups[0].options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: option.body.id, nameEn: "Large", priceDelta: 2000 }),
      ]),
    );
  });

  it("rejects attaching a modifier group from a different branch", async () => {
    const { branch, token } = await setupManager();
    const otherBranch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id);

    const otherGroup = await prisma.modifierGroup.create({
      data: { branchId: otherBranch.id, nameEn: "Milk", selectionType: "SINGLE" },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/menu-items/${menuItem.id}/modifier-groups`)
      .set("Authorization", `Bearer ${token}`)
      .send({ modifierGroupId: otherGroup.id })
      .expect(409);
  });

  it("hides a soft-deleted group from the public menu item view", async () => {
    const { branch, token } = await setupManager();
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id);

    const group = await request(app.getHttpServer())
      .post("/api/v1/admin/modifier-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, nameEn: "Temp", selectionType: "MULTIPLE" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/menu-items/${menuItem.id}/modifier-groups`)
      .set("Authorization", `Bearer ${token}`)
      .send({ modifierGroupId: group.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/modifier-groups/${group.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const publicItem = await request(app.getHttpServer())
      .get(`/api/v1/menu-items/${menuItem.id}`)
      .expect(200);
    expect(publicItem.body.modifierGroups).toHaveLength(0);
  });

  it("rejects a SINGLE-selection group with maxSelect > 1", async () => {
    const { branch, token } = await setupManager();

    await request(app.getHttpServer())
      .post("/api/v1/admin/modifier-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, nameEn: "Broken", selectionType: "SINGLE", maxSelect: 3 })
      .expect(400);
  });

  it("rejects modifier group creation from staff (manager/admin only)", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .post("/api/v1/admin/modifier-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, nameEn: "Should Fail", selectionType: "SINGLE" })
      .expect(403);
  });
});
