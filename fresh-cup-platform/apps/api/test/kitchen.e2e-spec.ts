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

describe("Kitchen (e2e)", () => {
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

  it("creates a kitchen station and attaches it to a menu item via prep time/station on checkout", async () => {
    const branch = await createTestBranch(prisma);
    const token = await setupManager(branch.id);

    const station = await request(app.getHttpServer())
      .post("/api/v1/admin/kitchen-stations")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId: branch.id, name: "Juice Bar" })
      .expect(201);

    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await request(app.getHttpServer())
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        branchId: branch.id,
        categoryId: category.id,
        nameEn: "Mango Sunrise",
        basePrice: 12000,
        stationId: station.body.id,
        prepTimeSeconds: 90,
      })
      .expect(201);

    expect(menuItem.body.stationId).toBe(station.body.id);
    expect(menuItem.body.prepTimeSeconds).toBe(90);

    const { accessToken } = await loginAsNewCustomer(app, sms);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.body.id, quantity: 1 })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "PICKUP" })
      .expect(201);

    expect(order.body.items[0]).toMatchObject({ stationId: station.body.id, prepTimeSeconds: 90 });
  });

  it("flags an order as late once elapsed prep time exceeds the item's prepTimeSeconds", async () => {
    const branch = await createTestBranch(prisma);
    const token = await setupManager(branch.id);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    await prisma.menuItem.update({ where: { id: menuItem.id }, data: { prepTimeSeconds: 1 } });

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

    await request(app.getHttpServer())
      .post("/api/v1/payments/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId: order.body.id, method: "CASH" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${order.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PREPARING" })
      .expect(200);

    // Backdate preparingAt so the 1-second prep window has definitely elapsed.
    await prisma.order.update({
      where: { id: order.body.id },
      data: { preparingAt: new Date(Date.now() - 5000) },
    });

    const queue = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/kitchen-queue?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const entry = queue.body.find((o: { id: string }) => o.id === order.body.id);
    expect(entry).toMatchObject({ isLate: true });
    expect(entry.elapsedSeconds).toBeGreaterThanOrEqual(4);
  });

  it("blocks staff from creating a kitchen station but allows manager/admin", async () => {
    const branch = await createTestBranch(prisma);
    const { email: staffEmail } = await createTestUser(prisma, "STAFF", branch.id);
    const staffToken = await loginAs(app, staffEmail, TEST_PASSWORD);

    await request(app.getHttpServer())
      .post("/api/v1/admin/kitchen-stations")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ branchId: branch.id, name: "Should Fail" })
      .expect(403);
  });
});
