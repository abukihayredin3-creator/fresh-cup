import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SMS_PROVIDER } from "../src/modules/auth/sms/sms-provider.interface";
import { CapturingSmsProvider } from "./utils/capturing-sms.provider";
import { testPhone } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Addresses (e2e)", () => {
  let app: INestApplication;
  let sms: CapturingSmsProvider;

  beforeAll(async () => {
    const capturingSms = new CapturingSmsProvider();
    ({ app } = await createTestApp((builder) =>
      builder.overrideProvider(SMS_PROVIDER).useValue(capturingSms),
    ));
    sms = capturingSms;
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAsNewCustomer(): Promise<string> {
    const phone = testPhone();
    await request(app.getHttpServer()).post("/api/v1/auth/otp/request").send({ phone }).expect(204);
    const code = sms.lastCodeFor(phone);
    const verify = await request(app.getHttpServer())
      .post("/api/v1/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    return verify.body.accessToken as string;
  }

  it("creates, lists, updates, and deletes an address for the authenticated user", async () => {
    const token = await loginAsNewCustomer();

    const created = await request(app.getHttpServer())
      .post("/api/v1/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Home", freeText: "Behind Merkato Anwar Mosque" })
      .expect(201);

    expect(created.body).toMatchObject({ label: "Home", isDefault: false });

    const list = await request(app.getHttpServer())
      .get("/api/v1/addresses")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/addresses/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Work" })
      .expect(200);
    expect(updated.body.label).toBe("Work");

    await request(app.getHttpServer())
      .delete(`/api/v1/addresses/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get("/api/v1/addresses")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("only ever marks one address as default at a time", async () => {
    const token = await loginAsNewCustomer();

    const first = await request(app.getHttpServer())
      .post("/api/v1/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Home", freeText: "Address one", isDefault: true })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Work", freeText: "Address two", isDefault: true })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get("/api/v1/addresses")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const defaults = list.body.filter((a: { isDefault: boolean }) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.body.id);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it("prevents one customer from accessing another customer's address", async () => {
    const tokenA = await loginAsNewCustomer();
    const tokenB = await loginAsNewCustomer();

    const created = await request(app.getHttpServer())
      .post("/api/v1/addresses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ label: "Home", freeText: "Private address" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/addresses/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ label: "Hacked" })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/addresses/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(403);
  });

  it("returns 404 for a nonexistent address", async () => {
    const token = await loginAsNewCustomer();
    await request(app.getHttpServer())
      .patch("/api/v1/addresses/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "X" })
      .expect(404);
  });
});
