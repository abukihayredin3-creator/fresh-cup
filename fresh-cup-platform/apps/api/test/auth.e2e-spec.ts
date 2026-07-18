import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SMS_PROVIDER } from "../src/modules/auth/sms/sms-provider.interface";
import type { PrismaService } from "../src/database/prisma.service";
import { CapturingSmsProvider } from "./utils/capturing-sms.provider";
import { createTestBranch, createTestUser, testPhone, TEST_PASSWORD } from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Auth (e2e)", () => {
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

  describe("OTP login", () => {
    it("requests and verifies an OTP code, creating a customer", async () => {
      const phone = testPhone();

      await request(app.getHttpServer())
        .post("/api/v1/auth/otp/request")
        .send({ phone })
        .expect(204);

      const code = sms.lastCodeFor(phone);

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/otp/verify")
        .send({ phone, code })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({ phone, role: "CUSTOMER" });
    });

    it("rejects an incorrect OTP code", async () => {
      const phone = testPhone();
      await request(app.getHttpServer())
        .post("/api/v1/auth/otp/request")
        .send({ phone })
        .expect(204);

      await request(app.getHttpServer())
        .post("/api/v1/auth/otp/verify")
        .send({ phone, code: "000000" })
        .expect(401);
    });

    it("rejects verification for a phone that never requested a code", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/otp/verify")
        .send({ phone: testPhone(), code: "123456" })
        .expect(401);
    });

    it("reuses the same user on a second login for the same phone", async () => {
      const phone = testPhone();
      await request(app.getHttpServer())
        .post("/api/v1/auth/otp/request")
        .send({ phone })
        .expect(204);
      const firstCode = sms.lastCodeFor(phone);
      const first = await request(app.getHttpServer())
        .post("/api/v1/auth/otp/verify")
        .send({ phone, code: firstCode })
        .expect(200);

      const userCountAfterFirst = await prisma.user.count({ where: { phone } });
      expect(userCountAfterFirst).toBe(1);
      expect(first.body.user.phone).toBe(phone);
    });
  });

  describe("Staff login", () => {
    it("logs in with correct email/password", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "ADMIN", branch.id);

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/staff/login")
        .send({ email, password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.user).toMatchObject({ email, role: "ADMIN" });
    });

    it("rejects an incorrect password", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "STAFF", branch.id);

      await request(app.getHttpServer())
        .post("/api/v1/auth/staff/login")
        .send({ email, password: "WrongPassword!" })
        .expect(401);
    });

    it("rejects a nonexistent email", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/staff/login")
        .send({ email: "nobody@test.freshcup.dev", password: TEST_PASSWORD })
        .expect(401);
    });
  });

  describe("Token refresh and logout", () => {
    it("rotates the refresh token and invalidates the old one", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "STAFF", branch.id);
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/staff/login")
        .send({ email, password: TEST_PASSWORD })
        .expect(200);

      const oldRefreshToken = login.body.refreshToken as string;

      const refreshed = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);

      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it("revokes a refresh token on logout", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "STAFF", branch.id);
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/staff/login")
        .send({ email, password: TEST_PASSWORD })
        .expect(200);

      const refreshToken = login.body.refreshToken as string;

      await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .send({ refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(401);
    });

    it("rejects an unknown refresh token", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "not-a-real-token" })
        .expect(401);
    });
  });

  describe("Protected routes", () => {
    it("rejects requests with no access token", async () => {
      await request(app.getHttpServer()).get("/api/v1/users/me").expect(401);
    });

    it("rejects requests with a malformed access token", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer not-a-real-jwt")
        .expect(401);
    });

    it("returns the authenticated user's profile with a valid token", async () => {
      const branch = await createTestBranch(prisma);
      const { email } = await createTestUser(prisma, "MANAGER", branch.id);
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/staff/login")
        .send({ email, password: TEST_PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(email);
        });
    });
  });
});
