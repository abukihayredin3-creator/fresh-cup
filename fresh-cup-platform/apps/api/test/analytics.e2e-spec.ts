import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
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

describe("Analytics (e2e)", () => {
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

  async function setupPaidOrder(branchId: string, basePrice = 10000) {
    const category = await createTestCategory(prisma, branchId);
    const menuItem = await createTestMenuItem(prisma, branchId, category.id, { basePrice });
    const { accessToken, userId } = await loginAsNewCustomer(app, sms);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);
    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId, orderType: "PICKUP" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId: order.body.id, method: "CASH" })
      .expect(201);
    return { orderId: order.body.id as string, userId, menuItemName: menuItem.nameEn };
  }

  it("reflects a paid order in the dashboard KPIs", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const managerToken = await loginAs(app, email, TEST_PASSWORD);

    await setupPaidOrder(branch.id, 12000);

    const dashboard = await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(dashboard.body.todayOrders).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.todayRevenue).toBeGreaterThanOrEqual(12000);
  });

  it("aggregates sales by day and reports the top-selling item", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const managerToken = await loginAs(app, email, TEST_PASSWORD);

    const { menuItemName } = await setupPaidOrder(branch.id, 15000);

    const sales = await request(app.getHttpServer())
      .get(`/api/v1/admin/analytics/sales?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(sales.body.totalRevenue).toBeGreaterThanOrEqual(15000);
    expect(sales.body.byDay.length).toBeGreaterThanOrEqual(1);

    const items = await request(app.getHttpServer())
      .get(`/api/v1/admin/analytics/items?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(items.body.items.some((i: { name: string }) => i.name === menuItemName)).toBe(true);
  });

  it("returns a customer-360 view with order and loyalty history", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const managerToken = await loginAs(app, email, TEST_PASSWORD);

    const { userId } = await setupPaidOrder(branch.id, 20000);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${userId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(detail.body).toMatchObject({ id: userId, ordersCount: 1, totalSpend: 20000 });
  });

  it("forbids a manager from viewing a customer who never ordered at their branch", async () => {
    const branch = await createTestBranch(prisma);
    const otherBranch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const managerToken = await loginAs(app, email, TEST_PASSWORD);

    const { userId } = await setupPaidOrder(otherBranch.id, 20000);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${userId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);
  });

  it("blocks staff and customers from the analytics endpoints", async () => {
    const branch = await createTestBranch(prisma);
    const { email: staffEmail } = await createTestUser(prisma, "STAFF", branch.id);
    const staffToken = await loginAs(app, staffEmail, TEST_PASSWORD);
    const { accessToken: customerToken } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(403);
  });
});
