import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../src/database/prisma.service";
import { createTestBranch, createTestUser, loginAs, TEST_PASSWORD } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Purchasing (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupSupplierAndItem(branchId: string, token: string) {
    const supplier = await request(app.getHttpServer())
      .post("/api/v1/admin/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, name: "Test Supplier" })
      .expect(201);

    const item = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, name: "Mango", unit: "GRAM", currentStock: 1000, unitCost: 8 })
      .expect(201);

    return { supplierId: supplier.body.id as string, inventoryItemId: item.body.id as string };
  }

  it("runs a full draft -> submit -> receive workflow and restocks inventory", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const { supplierId, inventoryItemId } = await setupSupplierAndItem(branch.id, token);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        supplierId,
        lines: [{ inventoryItemId, quantityOrdered: 500, unitCost: 8 }],
      })
      .expect(201);
    expect(draft.body.status).toBe("DRAFT");

    const submitted = await request(app.getHttpServer())
      .post(`/api/v1/admin/purchase-orders/${draft.body.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(submitted.body.status).toBe("SUBMITTED");

    const received = await request(app.getHttpServer())
      .post(`/api/v1/admin/purchase-orders/${draft.body.id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(received.body.status).toBe("RECEIVED");
    expect(received.body.lines[0].quantityReceived).toBe(500);

    const item = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${inventoryItemId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(item.body.currentStock).toBe(1500); // 1000 + 500 received

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { inventoryItemId, reason: "RESTOCK" },
    });
    expect(transactions).toHaveLength(1);
  });

  it("supports a partial receive against a specific line", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const { supplierId, inventoryItemId } = await setupSupplierAndItem(branch.id, token);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        supplierId,
        lines: [{ inventoryItemId, quantityOrdered: 500, unitCost: 8 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/purchase-orders/${draft.body.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const lineId = draft.body.lines[0].id as string;
    const received = await request(app.getHttpServer())
      .post(`/api/v1/admin/purchase-orders/${draft.body.id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ lines: [{ lineId, quantityReceived: 300 }] })
      .expect(201);

    expect(received.body.lines[0].quantityReceived).toBe(300);

    const item = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${inventoryItemId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(item.body.currentStock).toBe(1300); // 1000 + 300 received
  });

  it("rejects receiving a purchase order that hasn't been submitted yet", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const { supplierId, inventoryItemId } = await setupSupplierAndItem(branch.id, token);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        supplierId,
        lines: [{ inventoryItemId, quantityOrdered: 100, unitCost: 8 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/purchase-orders/${draft.body.id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it("rejects a purchase order line referencing an inventory item from a different branch", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const { supplierId } = await setupSupplierAndItem(branch.id, token);

    const otherBranch = await createTestBranch(prisma);
    const otherItem = await prisma.inventoryItem.create({
      data: { branchId: otherBranch.id, name: "Not Mine", unit: "GRAM", unitCost: 1 },
    });

    await request(app.getHttpServer())
      .post("/api/v1/admin/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        supplierId,
        lines: [{ inventoryItemId: otherItem.id, quantityOrdered: 10, unitCost: 1 }],
      })
      .expect(400);
  });

  it("cancels a draft purchase order without touching inventory", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    const { supplierId, inventoryItemId } = await setupSupplierAndItem(branch.id, token);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        supplierId,
        lines: [{ inventoryItemId, quantityOrdered: 100, unitCost: 8 }],
      })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/admin/purchase-orders/${draft.body.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");

    const item = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${inventoryItemId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(item.body.currentStock).toBe(1000); // unchanged
  });
});
