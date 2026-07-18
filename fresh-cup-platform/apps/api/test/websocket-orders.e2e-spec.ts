import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io, type Socket } from "socket.io-client";
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

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", (error: Error) => reject(error));
  });
}

describe("Orders WebSocket gateway (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: CapturingSmsProvider;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const capturingSms = new CapturingSmsProvider();
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(SMS_PROVIDER).useValue(capturingSms),
    ));
    sms = capturingSms;
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function connect(token: string): Socket {
    const socket = io(`${baseUrl}/ws/orders`, {
      transports: ["websocket"],
      auth: { token },
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  }

  async function setupConfirmableOrder() {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const { accessToken } = await loginAsNewCustomer(app, sms);
    const { email } = await createTestUser(prisma, "STAFF", branch.id);
    const staffToken = await loginAs(app, email, TEST_PASSWORD);

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

    return { branch, accessToken, staffToken, orderId: order.body.id as string };
  }

  it("rejects a connection with no auth token", async () => {
    const socket = io(`${baseUrl}/ws/orders`, { transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    await expect(waitForEvent(socket, "disconnect")).resolves.toBeDefined();
  });

  it("lets the order's owner subscribe and receive a status_changed event", async () => {
    const { accessToken, staffToken, orderId, branch } = await setupConfirmableOrder();

    const customerSocket = connect(accessToken);
    await waitForConnect(customerSocket);

    const ack = await new Promise<{ ok: boolean }>((resolve) =>
      customerSocket.emit("subscribeOrder", { orderId }, resolve),
    );
    expect(ack.ok).toBe(true);

    const eventPromise = waitForEvent<{ orderId: string; toStatus: string }>(
      customerSocket,
      "order.status_changed",
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "CONFIRMED" })
      .expect(200);

    const event = await eventPromise;
    expect(event).toMatchObject({ orderId, toStatus: "CONFIRMED" });
    void branch;
  });

  it("auto-joins staff to their branch room and broadcasts new order statuses there", async () => {
    const { staffToken, orderId, accessToken } = await setupConfirmableOrder();

    const staffSocket = connect(staffToken);
    await waitForConnect(staffSocket);
    const eventPromise = waitForEvent<{ orderId: string; toStatus: string }>(
      staffSocket,
      "order.status_changed",
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "CONFIRMED" })
      .expect(200);

    const event = await eventPromise;
    expect(event).toMatchObject({ orderId, toStatus: "CONFIRMED" });
    void accessToken;
  });

  it("rejects subscribing to another customer's order", async () => {
    const { orderId } = await setupConfirmableOrder();
    const { accessToken: otherToken } = await loginAsNewCustomer(app, sms);

    const socket = connect(otherToken);
    await waitForConnect(socket);

    const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) =>
      socket.emit("subscribeOrder", { orderId }, resolve),
    );
    expect(ack).toEqual({ ok: false, error: "forbidden" });
  });
});
