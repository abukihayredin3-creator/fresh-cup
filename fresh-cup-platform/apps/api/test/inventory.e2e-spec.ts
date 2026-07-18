import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import { createTestBranch, createTestUser, loginAs, TEST_PASSWORD } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Inventory (e2e)", () => {
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

  it("creates an inventory item and reports low-stock correctly", async () => {
    const { branch, token } = await setupManager();

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        name: "Mango",
        unit: "GRAM",
        currentStock: 1000,
        reorderThreshold: 2000,
        unitCost: 8,
      })
      .expect(201);

    expect(created.body).toMatchObject({ name: "Mango", currentStock: 1000, isLowStock: true });
  });

  it("adjusts stock and records a ledger transaction", async () => {
    const { branch, token } = await setupManager();
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, name: "Orange", unit: "GRAM", currentStock: 5000, unitCost: 6 })
      .expect(201);

    const adjusted = await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${created.body.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -1500, reason: "WASTE", note: "Spoiled batch" })
      .expect(201);

    expect(adjusted.body.currentStock).toBe(3500);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { inventoryItemId: created.body.id },
    });
    expect(transactions).toHaveLength(1);
    const [transaction] = transactions;
    expect(Number(transaction?.delta)).toBe(-1500);
    expect(transaction?.reason).toBe("WASTE");
  });

  it("rejects an adjustment that would take stock negative", async () => {
    const { branch, token } = await setupManager();
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        name: "Honey",
        unit: "MILLILITER",
        currentStock: 100,
        unitCost: 15,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${created.body.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -500, reason: "WASTE" })
      .expect(400);
  });

  it("lets staff adjust stock but not create inventory items", async () => {
    const { branch, token: managerToken } = await setupManager();
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ branchId: branch.id, name: "Granola", unit: "GRAM", currentStock: 1000, unitCost: 4 })
      .expect(201);

    const { email: staffEmail } = await createTestUser(prisma, "STAFF", branch.id);
    const staffToken = await loginAs(app, staffEmail, TEST_PASSWORD);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${created.body.id}/adjust`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ delta: 500, reason: "RESTOCK" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ branchId: branch.id, name: "Should Fail", unit: "GRAM", unitCost: 1 })
      .expect(403);
  });

  it("blocks a manager from adjusting another branch's inventory", async () => {
    const { token } = await setupManager();
    const otherBranch = await createTestBranch(prisma);
    const otherItem = await prisma.inventoryItem.create({
      data: { branchId: otherBranch.id, name: "Not Mine", unit: "UNIT", unitCost: 1 },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/inventory/${otherItem.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 10, reason: "RESTOCK" })
      .expect(403);
  });
});
