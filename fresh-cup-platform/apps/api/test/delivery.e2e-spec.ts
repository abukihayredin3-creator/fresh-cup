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

describe("Delivery (e2e)", () => {
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

  describe("zones", () => {
    it("quotes a distance-based fee for a point inside a configured zone", async () => {
      const branch = await createTestBranch(prisma);
      const token = await setupManager(branch.id);

      await request(app.getHttpServer())
        .post("/api/v1/admin/delivery-zones")
        .set("Authorization", `Bearer ${token}`)
        .send({
          branchId: branch.id,
          name: "Core Zone",
          centerLat: 9.0157,
          centerLng: 38.7369,
          radiusKm: 5,
          baseFee: 3000,
          perKmFee: 500,
        })
        .expect(201);

      const quote = await request(app.getHttpServer())
        .post("/api/v1/admin/delivery-zones/quote")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, lat: 9.02, lng: 38.74 })
        .expect(201);

      expect(quote.body.inZone).toBe(true);
      expect(quote.body.fee).toBeGreaterThan(3000);
    });

    it("falls back to the flat fee when the point is outside every configured zone", async () => {
      const branch = await createTestBranch(prisma);
      const token = await setupManager(branch.id);

      await request(app.getHttpServer())
        .post("/api/v1/admin/delivery-zones")
        .set("Authorization", `Bearer ${token}`)
        .send({
          branchId: branch.id,
          name: "Tiny Zone",
          centerLat: 9.0157,
          centerLng: 38.7369,
          radiusKm: 1,
          baseFee: 3000,
        })
        .expect(201);

      const quote = await request(app.getHttpServer())
        .post("/api/v1/admin/delivery-zones/quote")
        .set("Authorization", `Bearer ${token}`)
        .send({ branchId: branch.id, lat: 9.5, lng: 39.5 })
        .expect(201);

      expect(quote.body.inZone).toBe(false);
      expect(quote.body.fee).toBe(5000); // DELIVERY_FLAT_FEE from .env.local
    });
  });

  describe("driver management", () => {
    it("creates a driver account and lets manager/admin list it", async () => {
      const branch = await createTestBranch(prisma);
      const token = await setupManager(branch.id);

      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/drivers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          branchId: branch.id,
          email: `driver-${randomUUID()}@test.freshcup.dev`,
          password: "DriverPass123!",
          fullName: "Test Driver",
          vehicleType: "motorcycle",
        })
        .expect(201);

      expect(created.body.vehicleType).toBe("motorcycle");

      const list = await request(app.getHttpServer())
        .get("/api/v1/admin/drivers")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(list.body.items.some((d: { id: string }) => d.id === created.body.id)).toBe(true);
    });
  });

  describe("full delivery order lifecycle", () => {
    async function setupDeliveryOrder() {
      const branch = await createTestBranch(prisma);
      const managerToken = await setupManager(branch.id);

      await request(app.getHttpServer())
        .post("/api/v1/admin/delivery-zones")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          branchId: branch.id,
          name: "Core Zone",
          centerLat: 9.0157,
          centerLng: 38.7369,
          radiusKm: 10,
          baseFee: 3000,
          perKmFee: 500,
        })
        .expect(201);

      const category = await createTestCategory(prisma, branch.id);
      const menuItem = await createTestMenuItem(prisma, branch.id, category.id, {
        basePrice: 10000,
      });

      const { accessToken, userId } = await loginAsNewCustomer(app, sms);
      await request(app.getHttpServer())
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
        .expect(201);

      const address = await prisma.address.create({
        data: { userId, label: "Home", freeText: "Near Merkato", lat: 9.02, lng: 38.74 },
      });

      const order = await request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", randomUUID())
        .send({ branchId: branch.id, orderType: "DELIVERY", addressId: address.id })
        .expect(201);

      expect(order.body.deliveryFee).toBeGreaterThan(3000); // zone-based, not the flat fallback

      const driverEmail = `driver-${randomUUID()}@test.freshcup.dev`;
      const driverCreated = await request(app.getHttpServer())
        .post("/api/v1/admin/drivers")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          branchId: branch.id,
          email: driverEmail,
          password: "DriverPass123!",
          fullName: "Delivery Driver",
          vehicleType: "motorcycle",
        })
        .expect(201);
      const driverToken = await loginAs(app, driverEmail, "DriverPass123!");

      return {
        branch,
        managerToken,
        accessToken,
        orderId: order.body.id as string,
        driverToken,
        driverId: driverCreated.body.id as string,
      };
    }

    it("creates a Delivery row at checkout and drives it through assignment, pickup, and delivery", async () => {
      const { managerToken, accessToken, orderId, driverToken, driverId } =
        await setupDeliveryOrder();

      // Settle payment (cash) so the kitchen can move the order forward.
      await request(app.getHttpServer())
        .post("/api/v1/payments/initiate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ orderId, method: "CASH" })
        .expect(201);

      for (const status of ["PREPARING", "READY"]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${orderId}/status`)
          .set("Authorization", `Bearer ${managerToken}`)
          .send({ status })
          .expect(200);
      }

      const deliveries = await request(app.getHttpServer())
        .get("/api/v1/admin/deliveries")
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);
      const delivery = deliveries.body.items.find(
        (d: { orderId: string }) => d.orderId === orderId,
      );
      expect(delivery).toBeDefined();
      expect(delivery.status).toBe("UNASSIGNED");

      const assigned = await request(app.getHttpServer())
        .post(`/api/v1/admin/deliveries/${delivery.id}/assign`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ driverId })
        .expect(201);
      expect(assigned.body.status).toBe("ASSIGNED");

      // Driver reports a GPS ping while en route to the branch.
      await request(app.getHttpServer())
        .post("/api/v1/delivery/driver/location")
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ lat: 9.016, lng: 38.737 })
        .expect(204);

      const pickedUp = await request(app.getHttpServer())
        .patch(`/api/v1/delivery/driver/deliveries/${delivery.id}/status`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ status: "PICKED_UP" })
        .expect(200);
      expect(pickedUp.body.status).toBe("PICKED_UP");

      const orderAfterPickup = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(orderAfterPickup.body.status).toBe("OUT_FOR_DELIVERY");

      const delivered = await request(app.getHttpServer())
        .patch(`/api/v1/delivery/driver/deliveries/${delivery.id}/status`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ status: "DELIVERED" })
        .expect(200);
      expect(delivered.body.status).toBe("DELIVERED");

      const orderAfterDelivery = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(orderAfterDelivery.body.status).toBe("DELIVERED");

      const tracking = await request(app.getHttpServer())
        .get(`/api/v1/admin/deliveries/${delivery.id}/tracking`)
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);
      expect(tracking.body.length).toBeGreaterThanOrEqual(1);
    });

    it("rejects a driver from updating a delivery not assigned to them", async () => {
      const { managerToken, orderId, driverToken } = await setupDeliveryOrder();

      const deliveries = await request(app.getHttpServer())
        .get("/api/v1/admin/deliveries")
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);
      const delivery = deliveries.body.items.find(
        (d: { orderId: string }) => d.orderId === orderId,
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/delivery/driver/deliveries/${delivery.id}/status`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ status: "PICKED_UP" })
        .expect(400); // still UNASSIGNED — not assigned to this driver
    });

    it("rejects assigning an already-assigned delivery a second time", async () => {
      const { managerToken, orderId, driverId } = await setupDeliveryOrder();

      const deliveries = await request(app.getHttpServer())
        .get("/api/v1/admin/deliveries")
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);
      const delivery = deliveries.body.items.find(
        (d: { orderId: string }) => d.orderId === orderId,
      );

      await request(app.getHttpServer())
        .post(`/api/v1/admin/deliveries/${delivery.id}/assign`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ driverId })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/admin/deliveries/${delivery.id}/assign`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ driverId })
        .expect(400);
    });
  });
});
