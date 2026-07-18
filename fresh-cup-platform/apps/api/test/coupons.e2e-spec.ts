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
  uniqueSuffix,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Coupons (e2e)", () => {
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

  async function setupManager() {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "MANAGER", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);
    return { branch, token };
  }

  it("creates a coupon and rejects a duplicate code", async () => {
    const { token } = await setupManager();
    const code = `TEST${uniqueSuffix().toUpperCase()}`;

    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code, discountType: "PERCENT", value: 15 })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code, discountType: "PERCENT", value: 15 })
      .expect(409);
  });

  it("normalizes the code to uppercase", async () => {
    const { token } = await setupManager();
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `lower${uniqueSuffix()}`, discountType: "AMOUNT", value: 500 })
      .expect(201);
    expect(created.body.code).toBe(created.body.code.toUpperCase());
  });

  it("previews a discount via /coupons/validate", async () => {
    const { token } = await setupManager();
    const code = `PREVIEW${uniqueSuffix().toUpperCase()}`;
    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code, discountType: "PERCENT", value: 20 })
      .expect(201);

    const { accessToken } = await loginAsNewCustomer(app, sms);
    const preview = await request(app.getHttpServer())
      .post("/api/v1/coupons/validate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code, subtotal: 10000 })
      .expect(201);
    expect(preview.body.discountAmount).toBe(2000);
  });

  it("rejects an expired coupon", async () => {
    const { token } = await setupManager();
    const code = `EXPIRED${uniqueSuffix().toUpperCase()}`;
    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code,
        discountType: "AMOUNT",
        value: 1000,
        expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .expect(201);

    const { accessToken } = await loginAsNewCustomer(app, sms);
    await request(app.getHttpServer())
      .post("/api/v1/coupons/validate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code, subtotal: 10000 })
      .expect(400);
  });

  it("applies a percent discount at checkout and enforces the per-user redemption cap", async () => {
    const { branch, token } = await setupManager();
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const code = `ONCE${uniqueSuffix().toUpperCase()}`;
    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code, discountType: "PERCENT", value: 10, maxRedemptionsPerUser: 1 })
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
      .send({ branchId: branch.id, orderType: "PICKUP", couponCode: code })
      .expect(201);

    expect(order.body.discountTotal).toBe(1000);
    expect(order.body.total).toBe(9000);

    // second order, same coupon, same user -> blocked by maxRedemptionsPerUser
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "PICKUP", couponCode: code })
      .expect(400);
  });

  it("waives the delivery fee for a FREE_DELIVERY coupon", async () => {
    const { branch, token } = await setupManager();
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const code = `FREESHIP${uniqueSuffix().toUpperCase()}`;
    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code, discountType: "FREE_DELIVERY" })
      .expect(201);

    const { accessToken, userId } = await loginAsNewCustomer(app, sms);
    const address = await prisma.address.create({
      data: { userId, label: "Home", freeText: "Somewhere" },
    });

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "DELIVERY", addressId: address.id, couponCode: code })
      .expect(201);

    expect(order.body.deliveryFee).toBe(0);
    expect(order.body.total).toBe(order.body.subtotal);
  });

  it("rejects coupon creation from staff (manager/admin only)", async () => {
    const branch = await createTestBranch(prisma);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const token = await loginAs(app, email, TEST_PASSWORD);

    await request(app.getHttpServer())
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `NOPE${uniqueSuffix()}`, discountType: "AMOUNT", value: 100 })
      .expect(403);
  });
});
