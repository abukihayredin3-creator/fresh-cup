import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import { createTestBranch, createTestUser, loginAs } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Catalog (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Menu categories", () => {
    it("lets a manager create a category and the public see it", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "MANAGER", branch.id);
      const token = await loginAs(app, email, "TestPassword123!");

      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, nameEn: "Fresh Juices" })
        .expect(201);

      expect(created.body).toMatchObject({ nameEn: "Fresh Juices", isActive: true });

      const publicList = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branch.id}/menu-categories`)
        .expect(200);

      expect(publicList.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ nameEn: "Fresh Juices" })]),
      );
    });

    it("rejects category creation from a customer", async () => {
      const branch = await createTestBranch(prisma);

      await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .send({ branchId: branch.id, nameEn: "Should Fail" })
        .expect(401); // no token at all
    });

    it("rejects category creation from staff (manager/admin only)", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "STAFF", branch.id);
      const token = await loginAs(app, email, "TestPassword123!");

      await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, nameEn: "Should Fail" })
        .expect(403);
    });

    it("blocks a manager from creating a category in a different branch", async () => {
      const ownBranch = await createTestBranch(prisma);
      const otherBranch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "MANAGER", ownBranch.id);
      const token = await loginAs(app, email, "TestPassword123!");

      await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: otherBranch.id, nameEn: "Not Mine" })
        .expect(403);
    });

    it("soft-deletes a category instead of hard-deleting it", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "ADMIN", branch.id);
      const token = await loginAs(app, email, "TestPassword123!");

      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, nameEn: "Temporary" })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/menu-categories/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      const stillExists = await prisma.menuCategory.findUnique({ where: { id: created.body.id } });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.isActive).toBe(false);

      const publicList = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branch.id}/menu-categories`)
        .expect(200);
      expect(publicList.body).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );
    });

    it("validates required fields", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "ADMIN", branch.id);
      const token = await loginAs(app, email, "TestPassword123!");

      await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id })
        .expect(400);
    });
  });

  describe("Menu items", () => {
    async function setupCategory(role: "MANAGER" | "ADMIN" = "ADMIN") {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, role, branch.id);
      const token = await loginAs(app, email, "TestPassword123!");
      const category = await request(app.getHttpServer())
        .post("/api/v1/admin/menu-categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, nameEn: "Juices" })
        .expect(201);
      return { branch, token, categoryId: category.body.id as string };
    }

    it("creates a menu item with an image and exposes it publicly once available", async () => {
      const { branch, token, categoryId } = await setupCategory();

      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/menu-items")
        .set("Authorization", `Bearer ${token}`)
        .send({
          branchId: branch.id,
          categoryId,
          nameEn: "Mango Sunrise",
          basePrice: 12000,
        })
        .expect(201);

      expect(created.body).toMatchObject({
        nameEn: "Mango Sunrise",
        basePrice: 12000,
        isAvailable: true,
      });

      const image = await request(app.getHttpServer())
        .post(`/api/v1/admin/menu-items/${created.body.id}/images`)
        .set("Authorization", `Bearer ${token}`)
        .send({ url: "https://cdn.example.com/mango.jpg", isPrimary: true })
        .expect(201);

      expect(image.body).toMatchObject({
        url: "https://cdn.example.com/mango.jpg",
        isPrimary: true,
      });

      const publicDetail = await request(app.getHttpServer())
        .get(`/api/v1/menu-items/${created.body.id}`)
        .expect(200);
      expect(publicDetail.body.images).toHaveLength(1);
    });

    it("hides unavailable items from the public detail endpoint", async () => {
      const { branch, token, categoryId } = await setupCategory();
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/menu-items")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, categoryId, nameEn: "Hidden Item", basePrice: 5000 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/menu-items/${created.body.id}/availability`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isAvailable: false })
        .expect(200);

      await request(app.getHttpServer()).get(`/api/v1/menu-items/${created.body.id}`).expect(404);

      // Staff can still see it via the admin endpoint.
      await request(app.getHttpServer())
        .get(`/api/v1/admin/menu-items/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.isAvailable).toBe(false);
        });
    });

    it("lets staff (not just manager/admin) toggle availability", async () => {
      const { branch, token, categoryId } = await setupCategory();
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/menu-items")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, categoryId, nameEn: "Toggle Item", basePrice: 5000 })
        .expect(201);

      const { email: staffEmail } = await createTestUser(prisma, "STAFF", branch.id);
      const staffToken = await loginAs(app, staffEmail, "TestPassword123!");

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/menu-items/${created.body.id}/availability`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ isAvailable: false })
        .expect(200);
    });

    it("rejects a negative base price", async () => {
      const { branch, token, categoryId } = await setupCategory();

      await request(app.getHttpServer())
        .post("/api/v1/admin/menu-items")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, categoryId, nameEn: "Bad Price", basePrice: -100 })
        .expect(400);
    });

    it("paginates the public listing", async () => {
      const { branch, token, categoryId } = await setupCategory();
      for (let i = 0; i < 3; i += 1) {
        await request(app.getHttpServer())
          .post("/api/v1/admin/menu-items")
          .set("Authorization", `Bearer ${token}`)
          .send({ branchId: branch.id, categoryId, nameEn: `Item ${i}`, basePrice: 1000 })
          .expect(201);
      }

      const firstPage = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branch.id}/menu-items?limit=2`)
        .expect(200);

      expect(firstPage.body.items).toHaveLength(2);
      expect(firstPage.body.nextCursor).toEqual(expect.any(String));

      const secondPage = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branch.id}/menu-items?limit=2&cursor=${firstPage.body.nextCursor}`)
        .expect(200);

      expect(secondPage.body.items).toHaveLength(1);
    });
  });
});
