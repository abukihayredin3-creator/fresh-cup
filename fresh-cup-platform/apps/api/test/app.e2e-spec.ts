import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET / returns 200 with the API status payload", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          name: "Fresh Cup API",
          status: "running",
          version: "1.0.0",
          timestamp: expect.any(String),
        });
        expect(new Date(res.body.timestamp).toString()).not.toBe("Invalid Date");
      });
  });

  it("GET / requires no authentication", () => {
    return request(app.getHttpServer()).get("/").expect(200);
  });
});
