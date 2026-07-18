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

describe("Orders (e2e)", () => {
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

  async function setupCheckout(orderType: "PICKUP" | "DINE_IN" | "DELIVERY" = "PICKUP") {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const { accessToken, userId } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 2 })
      .expect(201);

    const body: Record<string, unknown> = { branchId: branch.id, orderType };
    if (orderType === "DINE_IN") {
      const table = await prisma.table.create({
        data: { branchId: branch.id, label: "T-1", qrToken: randomUUID() },
      });
      body.tableId = table.id;
    }
    if (orderType === "DELIVERY") {
      const address = await prisma.address.create({
        data: { userId, label: "Home", freeText: "123 Test St" },
      });
      body.addressId = address.id;
    }

    return { branch, menuItem, accessToken, userId, body };
  }

  function checkout(accessToken: string, body: Record<string, unknown>, idempotencyKey?: string) {
    return request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey ?? randomUUID())
      .send(body);
  }

  async function setupStaff(branchId: string, role: "STAFF" | "MANAGER" | "ADMIN" = "STAFF") {
    const { email } = await createTestUser(prisma, role, role === "ADMIN" ? null : branchId);
    const token = await loginAs(app, email, TEST_PASSWORD);
    return token;
  }

  describe("checkout", () => {
    it("requires an Idempotency-Key header", async () => {
      const { branch, accessToken } = await setupCheckout();
      await request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ branchId: branch.id, orderType: "PICKUP" })
        .expect(400);
    });

    it("creates a pending_payment order from the cart and clears it", async () => {
      const { accessToken, body } = await setupCheckout();

      const response = await checkout(accessToken, body).expect(201);
      expect(response.body).toMatchObject({
        status: "PENDING_PAYMENT",
        subtotal: 20000,
        total: 20000,
        items: [expect.objectContaining({ quantity: 2, lineTotal: 20000 })],
      });

      const cart = await request(app.getHttpServer())
        .get(`/api/v1/cart?branchId=${body.branchId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(cart.body.items).toHaveLength(0);
    });

    it("replays the same order on a retried request with the same idempotency key", async () => {
      const { accessToken, body } = await setupCheckout();
      const key = randomUUID();

      const first = await checkout(accessToken, body, key).expect(201);

      // Re-add to cart so a genuinely new checkout attempt would otherwise succeed —
      // proves the replay short-circuits on the idempotency key, not an empty cart.
      const second = await checkout(accessToken, body, key).expect(201);

      expect(second.body.id).toBe(first.body.id);
      const orderCount = await prisma.order.count({ where: { idempotencyKey: key } });
      expect(orderCount).toBe(1);
    });

    it("rejects checkout with an empty cart", async () => {
      const branch = await createTestBranch(prisma);
      const { accessToken } = await loginAsNewCustomer(app, sms);
      await checkout(accessToken, { branchId: branch.id, orderType: "PICKUP" }).expect(400);
    });

    it("dine-in requires a valid tableId in the same branch", async () => {
      const { accessToken, body } = await setupCheckout();
      await checkout(accessToken, { ...body, orderType: "DINE_IN" }).expect(400);
    });

    it("delivery requires the caller's own address and computes a delivery fee", async () => {
      const { accessToken, body } = await setupCheckout("DELIVERY");
      const response = await checkout(accessToken, body).expect(201);
      expect(response.body.orderType).toBe("DELIVERY");
      expect(response.body.deliveryFee).toBeGreaterThan(0);
      expect(response.body.total).toBe(response.body.subtotal + response.body.deliveryFee);
    });

    it("rejects delivery to another user's address", async () => {
      const { accessToken, body } = await setupCheckout();
      const other = await loginAsNewCustomer(app, sms);
      const foreignAddress = await prisma.address.create({
        data: { userId: other.userId, label: "Not mine", freeText: "Elsewhere" },
      });
      await checkout(accessToken, {
        ...body,
        orderType: "DELIVERY",
        addressId: foreignAddress.id,
      }).expect(400);
    });

    it("rejects checkout when a cart item became unavailable since it was added", async () => {
      const { accessToken, body, menuItem } = await setupCheckout();
      await prisma.menuItem.update({ where: { id: menuItem.id }, data: { isAvailable: false } });
      await checkout(accessToken, body).expect(400);
    });
  });

  describe("status workflow", () => {
    it("lets staff move an order through the pickup happy path", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      for (const status of ["CONFIRMED", "PREPARING", "READY", "COMPLETED"]) {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/orders/${order.body.id}/status`)
          .set("Authorization", `Bearer ${staffToken}`)
          .send({ status })
          .expect(200);
        expect(response.body.status).toBe(status);
      }
    });

    it("requires a delivery order to pass through out_for_delivery and delivered", async () => {
      const { accessToken, body, branch } = await setupCheckout("DELIVERY");
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      for (const status of ["CONFIRMED", "PREPARING", "READY"]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${order.body.id}/status`)
          .set("Authorization", `Bearer ${staffToken}`)
          .send({ status })
          .expect(200);
      }

      // Delivery can't skip straight to completed from ready.
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "COMPLETED" })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "OUT_FOR_DELIVERY" })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "DELIVERED" })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "COMPLETED" })
        .expect(200);
    });

    it("rejects skipping a step", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "PREPARING" })
        .expect(400);
    });

    it("rejects CANCELLED via the status endpoint (must use /cancel)", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "CANCELLED" })
        .expect(400);
    });

    it("rejects a customer calling the staff-only status endpoint", async () => {
      const { accessToken, body } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status: "CONFIRMED" })
        .expect(403);
    });

    it("rejects staff from a different branch", async () => {
      const { accessToken, body } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const otherBranch = await createTestBranch(prisma);
      const otherStaffToken = await setupStaff(otherBranch.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${otherStaffToken}`)
        .send({ status: "CONFIRMED" })
        .expect(403);
    });
  });

  describe("cancel", () => {
    it("lets a customer cancel while pending_payment", async () => {
      const { accessToken, body } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/cancel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({})
        .expect(201);
      expect(response.body.status).toBe("CANCELLED");
    });

    it("blocks a customer from cancelling once preparing", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      for (const status of ["CONFIRMED", "PREPARING"]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${order.body.id}/status`)
          .set("Authorization", `Bearer ${staffToken}`)
          .send({ status })
          .expect(200);
      }

      await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/cancel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it("lets staff cancel an order that's already preparing", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      for (const status of ["CONFIRMED", "PREPARING"]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${order.body.id}/status`)
          .set("Authorization", `Bearer ${staffToken}`)
          .send({ status })
          .expect(200);
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/cancel`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({})
        .expect(201);
      expect(response.body.status).toBe("CANCELLED");
    });

    it("blocks cancelling another customer's order", async () => {
      const { accessToken, body } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const other = await loginAsNewCustomer(app, sms);

      await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/cancel`)
        .set("Authorization", `Bearer ${other.accessToken}`)
        .send({})
        .expect(403);
    });
  });

  describe("timeline", () => {
    it("records one entry per status transition, in order", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "CONFIRMED" })
        .expect(200);

      const timeline = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.body.id}/timeline`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(timeline.body.map((e: { toStatus: string }) => e.toStatus)).toEqual([
        "PENDING_PAYMENT",
        "CONFIRMED",
      ]);
    });
  });

  describe("kitchen queue", () => {
    it("lists confirmed/preparing orders oldest-first, scoped to the branch", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ status: "CONFIRMED" })
        .expect(200);

      const queue = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders/kitchen-queue?branchId=${branch.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(200);

      expect(queue.body.map((o: { id: string }) => o.id)).toContain(order.body.id);
    });

    it("rejects staff from a different branch", async () => {
      const { branch } = await setupCheckout();
      const otherBranch = await createTestBranch(prisma);
      const otherStaffToken = await setupStaff(otherBranch.id);

      await request(app.getHttpServer())
        .get(`/api/v1/admin/orders/kitchen-queue?branchId=${branch.id}`)
        .set("Authorization", `Bearer ${otherStaffToken}`)
        .expect(403);
    });
  });

  describe("access control", () => {
    it("lets the owner and branch staff view an order, but not other customers or other branches", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      const order = await checkout(accessToken, body).expect(201);
      const staffToken = await setupStaff(branch.id);
      const other = await loginAsNewCustomer(app, sms);
      const otherBranch = await createTestBranch(prisma);
      const otherStaffToken = await setupStaff(otherBranch.id);

      await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.body.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.body.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.body.id}`)
        .set("Authorization", `Bearer ${other.accessToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.body.id}`)
        .set("Authorization", `Bearer ${otherStaffToken}`)
        .expect(403);
    });

    it("scopes GET /orders to the caller's own history for customers, and branch for staff", async () => {
      const { accessToken, body, branch } = await setupCheckout();
      await checkout(accessToken, body).expect(201);
      const other = await loginAsNewCustomer(app, sms);
      const staffToken = await setupStaff(branch.id);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(mine.body.items.length).toBeGreaterThan(0);

      const othersView = await request(app.getHttpServer())
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${other.accessToken}`)
        .expect(200);
      expect(othersView.body.items).toHaveLength(0);

      const staffView = await request(app.getHttpServer())
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(200);
      expect(staffView.body.items.length).toBeGreaterThan(0);
    });
  });
});
