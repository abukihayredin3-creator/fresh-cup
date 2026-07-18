import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok status", () => {
    return request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe("ok");
      });
  });

  it("GET /health/ready reports database and redis connectivity", () => {
    return request(app.getHttpServer())
      .get("/health/ready")
      .expect(200)
      .expect((res) => {
        expect(res.body.dependencies).toEqual({ database: true, redis: true });
      });
  });
});
