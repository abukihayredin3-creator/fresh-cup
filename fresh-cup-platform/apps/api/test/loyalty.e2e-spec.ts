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

describe("Loyalty (e2e)", () => {
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

  it("starts at a zero balance with empty history", async () => {
    const { accessToken } = await loginAsNewCustomer(app, sms);
    const response = await request(app.getHttpServer())
      .get("/api/v1/loyalty/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ balance: 0, history: [] });
  });

  it("accrues points across two paid orders and keeps a running balance", async () => {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const { accessToken } = await loginAsNewCustomer(app, sms);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const staffToken = await loginAs(app, email, TEST_PASSWORD);

    for (let i = 0; i < 2; i++) {
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
      const payment = await request(app.getHttpServer())
        .post("/api/v1/payments/initiate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ orderId: order.body.id, method: "CASH" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.body.id}/confirm-cash`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(201);
    }

    const loyalty = await request(app.getHttpServer())
      .get("/api/v1/loyalty/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(loyalty.body.balance).toBe(20); // 2 orders x floor(10000/1000)
    expect(loyalty.body.history).toHaveLength(2);
    expect(loyalty.body.history[0].balanceAfter).toBe(20); // newest first
    expect(loyalty.body.history[1].balanceAfter).toBe(10);
  });

  it("keeps loyalty balances isolated between customers", async () => {
    const { accessToken: customerA } = await loginAsNewCustomer(app, sms);
    const { accessToken: customerB } = await loginAsNewCustomer(app, sms);

    const responseB = await request(app.getHttpServer())
      .get("/api/v1/loyalty/me")
      .set("Authorization", `Bearer ${customerB}`)
      .expect(200);
    expect(responseB.body.balance).toBe(0);

    // sanity: customer A's own call still works independently
    await request(app.getHttpServer())
      .get("/api/v1/loyalty/me")
      .set("Authorization", `Bearer ${customerA}`)
      .expect(200);
  });
});
