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

describe("Payments (e2e)", () => {
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

  async function setupPendingOrder() {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const { accessToken, userId } = await loginAsNewCustomer(app, sms);

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

    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const staffToken = await loginAs(app, email, TEST_PASSWORD);

    return { branch, accessToken, userId, orderId: order.body.id as string, staffToken };
  }

  it("initiates a Chapa payment in sandbox mode (no CHAPA_SECRET_KEY configured)", async () => {
    const { accessToken, orderId } = await setupPendingOrder();

    const response = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "TELEBIRR" })
      .expect(201);

    expect(response.body).toMatchObject({
      provider: "CHAPA",
      method: "TELEBIRR",
      status: "INITIATED",
    });
    expect(response.body.checkoutUrl).toEqual(expect.stringContaining("chapa.co"));

    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(order.body.status).toBe("PENDING_PAYMENT"); // still awaiting webhook confirmation
  });

  it("cash payment confirms the order immediately but stays unsettled until staff confirm", async () => {
    const { accessToken, orderId } = await setupPendingOrder();

    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "CASH" })
      .expect(201);
    expect(initiated.body).toMatchObject({
      provider: "CASH",
      status: "INITIATED",
      checkoutUrl: null,
    });

    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(order.body.status).toBe("CONFIRMED"); // kitchen can start without waiting for cash
  });

  it("confirming cash receipt settles the payment and accrues loyalty points", async () => {
    const { accessToken, orderId, staffToken } = await setupPendingOrder();

    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "CASH" })
      .expect(201);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/confirm-cash`)
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(201);
    expect(confirmed.body.status).toBe("SUCCEEDED");

    const loyalty = await request(app.getHttpServer())
      .get("/api/v1/loyalty/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(loyalty.body.balance).toBeGreaterThan(0);
  });

  it("a Chapa webhook success payload confirms the order and settles the payment", async () => {
    const { accessToken, orderId } = await setupPendingOrder();

    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "CBE_BIRR" })
      .expect(201);
    const txRef = initiated.body.providerReference as string;

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhooks/chapa")
      .send({ tx_ref: txRef, status: "success" })
      .expect(200);

    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(order.body.status).toBe("CONFIRMED");

    const payment = await prisma.payment.findUnique({ where: { id: initiated.body.id } });
    expect(payment?.status).toBe("SUCCEEDED");
  });

  it("is idempotent against a duplicate webhook delivery", async () => {
    const { accessToken, orderId } = await setupPendingOrder();
    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "AMOLE" })
      .expect(201);
    const txRef = initiated.body.providerReference as string;

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhooks/chapa")
      .send({ tx_ref: txRef, status: "success" })
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/payments/webhooks/chapa")
      .send({ tx_ref: txRef, status: "success" })
      .expect(200);

    const loyaltyEntries = await prisma.loyaltyLedger.count({ where: { orderId } });
    expect(loyaltyEntries).toBe(1);
  });

  it("refunds a succeeded payment (admin only)", async () => {
    const { accessToken, orderId, staffToken, branch } = await setupPendingOrder();
    const initiated = await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "CASH" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/confirm-cash`)
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/refund`)
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(403); // staff, not admin

    const { email } = await createTestUser(prisma, "ADMIN", branch.id);
    const adminToken = await loginAs(app, email, TEST_PASSWORD);
    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/payments/${initiated.body.id}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    expect(refunded.body.status).toBe("REFUNDED");
  });

  it("rejects initiating payment for someone else's order", async () => {
    const { orderId } = await setupPendingOrder();
    const { accessToken: otherToken } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ orderId, method: "CASH" })
      .expect(403);
  });

  it("rejects initiating a second payment once the order is no longer pending payment", async () => {
    const { accessToken, orderId } = await setupPendingOrder();
    await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "CASH" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, method: "CASH" })
      .expect(400);
  });
});
