import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import request from "supertest";
import { SMS_PROVIDER } from "../src/modules/auth/sms/sms-provider.interface";
import type { PrismaService } from "../src/database/prisma.service";
import { CapturingSmsProvider } from "./utils/capturing-sms.provider";
import {
  createTestBranch,
  createTestCategory,
  createTestMenuItem,
  createTestUser,
  loginAs,
  loginAsNewCustomer,
  TEST_PASSWORD,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Inventory automation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: CapturingSmsProvider;

  beforeAll(async () => {
    const capturingSms = new CapturingSmsProvider();
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(SMS_PROVIDER).useValue(capturingSms),
    ));
    sms = capturingSms;
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupManager(branchId: string) {
    const { email } = await createTestUser(prisma, "MANAGER", branchId);
    return loginAs(app, email, TEST_PASSWORD);
  }

  it("deducts recipe-mapped ingredient stock when an order is paid", async () => {
    const branch = await createTestBranch(prisma);
    const token = await setupManager(branch.id);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });

    const inventoryItem = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, name: "Mango", unit: "GRAM", currentStock: 2000, unitCost: 8 })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/admin/recipe-ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        menuItemId: menuItem.id,
        inventoryItemId: inventoryItem.body.id,
        quantityPerUnit: 250,
      })
      .expect(201);

    const { accessToken } = await loginAsNewCustomer(app, sms);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 3 })
      .expect(201);
    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "PICKUP" })
      .expect(201);

    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId: order.body.id, method: "CASH" })
      .expect(201);

    // Deduction fires on ORDER_EVENTS.PAID, which cash only emits at confirm-cash.
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/confirm-cash`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const item = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${inventoryItem.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(item.body.currentStock).toBe(1250); // 2000 - (250 * 3)

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { inventoryItemId: inventoryItem.body.id, reason: "ORDER_DEDUCTION" },
    });
    expect(transactions).toHaveLength(1);
    expect(Number(transactions[0]?.delta)).toBe(-750);
  });

  it("does not double-deduct if order.paid is somehow processed twice", async () => {
    const branch = await createTestBranch(prisma);
    const token = await setupManager(branch.id);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const inventoryItem = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, name: "Orange", unit: "GRAM", currentStock: 2000, unitCost: 6 })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/admin/recipe-ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        menuItemId: menuItem.id,
        inventoryItemId: inventoryItem.body.id,
        quantityPerUnit: 300,
      })
      .expect(201);

    const { accessToken } = await loginAsNewCustomer(app, sms);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);
    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "PICKUP" })
      .expect(201);
    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId: order.body.id, method: "CASH" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/confirm-cash`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    // Refund-then-nothing doesn't re-trigger PAID, but simulate a raw duplicate
    // event to exercise the interceptor's own idempotency guard directly.
    const eventEmitter = app.get(EventEmitter2);
    await eventEmitter.emitAsync("order.paid", {
      orderId: order.body.id,
      branchId: branch.id,
      userId: (await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).userId,
      total: 10000,
      currency: "ETB",
    });

    const item = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/${inventoryItem.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(item.body.currentStock).toBe(1700); // 2000 - 300, not 2000 - 600
  });

  it("exposes low-stock items via the dashboard endpoint after a deduction crosses the threshold", async () => {
    const branch = await createTestBranch(prisma);
    const token = await setupManager(branch.id);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const inventoryItem = await request(app.getHttpServer())
      .post("/api/v1/admin/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        name: "Honey",
        unit: "MILLILITER",
        currentStock: 100,
        reorderThreshold: 50,
        unitCost: 15,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/admin/recipe-ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        menuItemId: menuItem.id,
        inventoryItemId: inventoryItem.body.id,
        quantityPerUnit: 60,
      })
      .expect(201);

    const { accessToken } = await loginAsNewCustomer(app, sms);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);
    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "PICKUP" })
      .expect(201);
    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId: order.body.id, method: "CASH" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/confirm-cash`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    // 100 - 60 = 40, below the 50 reorder threshold.
    const lowStock = await request(app.getHttpServer())
      .get(`/api/v1/admin/inventory/low-stock?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(lowStock.body.some((i: { id: string }) => i.id === inventoryItem.body.id)).toBe(true);
  });
});
