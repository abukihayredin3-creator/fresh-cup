import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { MenuCategory, MenuItem, UserRole } from "@prisma/client";
import { type Branch } from "@prisma/client";
import request from "supertest";
import { hashPassword } from "../../src/common/crypto/password.util";
import type { PrismaService } from "../../src/database/prisma.service";

/** Unique per call so parallel test files never collide on unique columns. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function testPhone(): string {
  // +2519 followed by 8 digits derived from a random hex suffix, always valid E.164.
  const digits = randomUUID().replace(/\D/g, "").slice(0, 8).padEnd(8, "0");
  return `+2519${digits}`;
}

export async function createTestBranch(prisma: PrismaService): Promise<Branch> {
  return prisma.branch.create({
    data: {
      name: `Test Branch ${uniqueSuffix()}`,
      addressText: "123 Test Street, Addis Ababa",
    },
  });
}

export const TEST_PASSWORD = "TestPassword123!";

export async function createTestUser(
  prisma: PrismaService,
  role: UserRole,
  branchId: string | null,
) {
  const email = `${role.toLowerCase()}-${uniqueSuffix()}@test.freshcup.dev`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      fullName: `Test ${role}`,
      role,
      branchId,
    },
  });
  return { user, email, password: TEST_PASSWORD };
}

/** Logs in through the real HTTP endpoint so tests exercise the real auth path. */
export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/staff/login")
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

/** Same OTP flow auth.e2e-spec.ts exercises directly — reused by every ordering-flow spec. */
export async function loginAsNewCustomer(
  app: INestApplication,
  sms: { lastCodeFor(phone: string): string },
): Promise<{ accessToken: string; userId: string; phone: string }> {
  const phone = testPhone();
  await request(app.getHttpServer()).post("/api/v1/auth/otp/request").send({ phone }).expect(204);
  const code = sms.lastCodeFor(phone);
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/otp/verify")
    .send({ phone, code })
    .expect(200);
  return {
    accessToken: response.body.accessToken as string,
    userId: response.body.user.id as string,
    phone,
  };
}

export async function createTestCategory(
  prisma: PrismaService,
  branchId: string,
): Promise<MenuCategory> {
  return prisma.menuCategory.create({
    data: { branchId, nameEn: `Test Category ${uniqueSuffix()}` },
  });
}

export async function createTestMenuItem(
  prisma: PrismaService,
  branchId: string,
  categoryId: string,
  overrides: Partial<{ nameEn: string; basePrice: number; isAvailable: boolean }> = {},
): Promise<MenuItem> {
  return prisma.menuItem.create({
    data: {
      branchId,
      categoryId,
      nameEn: overrides.nameEn ?? `Test Item ${uniqueSuffix()}`,
      basePrice: overrides.basePrice ?? 10000,
      isAvailable: overrides.isAvailable ?? true,
    },
  });
}
