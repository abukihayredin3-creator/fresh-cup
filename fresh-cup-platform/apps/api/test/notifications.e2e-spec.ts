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
  loginAsNewCustomer,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Notifications (e2e)", () => {
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

  it("registers and unregisters a push token for the current user", async () => {
    const { accessToken, userId } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .post("/api/v1/notifications/push-tokens")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ token: `fcm-${randomUUID()}`, platform: "ANDROID" })
      .expect(204);

    const stored = await prisma.pushToken.findFirst({ where: { userId } });
    expect(stored).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/notifications/push-tokens/${stored!.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const afterDelete = await prisma.pushToken.findUnique({ where: { id: stored!.id } });
    expect(afterDelete).toBeNull();
  });

  it("rejects unregistering another user's push token", async () => {
    const { accessToken: ownerToken, userId } = await loginAsNewCustomer(app, sms);
    const { accessToken: intruderToken } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .post("/api/v1/notifications/push-tokens")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: `fcm-${randomUUID()}`, platform: "IOS" })
      .expect(204);
    const token = await prisma.pushToken.findFirstOrThrow({ where: { userId } });

    await request(app.getHttpServer())
      .delete(`/api/v1/notifications/push-tokens/${token.id}`)
      .set("Authorization", `Bearer ${intruderToken}`)
      .expect(404);
  });

  it("logs a SENT SMS notification when an order is placed", async () => {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 5000 });
    const { accessToken, userId } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ branchId: branch.id, orderType: "PICKUP" })
      .expect(201);

    const logs = await prisma.notificationLog.findMany({
      where: { userId, type: "order_created" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ channel: "SMS", status: "SENT" });
  });
});
