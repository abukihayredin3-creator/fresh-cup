import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { DeviceTrustService } from "./device-trust.service";

describe("DeviceTrustService", () => {
  function makeService(overrides: { device?: unknown }) {
    const prisma = {
      trustedDevice: {
        upsert: jest
          .fn()
          .mockImplementation(({ create }) => Promise.resolve({ id: "dev-1", ...create })),
        findUnique: jest.fn().mockResolvedValue(overrides.device ?? null),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "dev-1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new DeviceTrustService(prisma), prisma };
  }

  it("trusts a device and stores only a hash", async () => {
    const { service, prisma } = makeService({});
    await service.trustDevice("user-1", { fingerprint: "raw-fingerprint-value" });
    expect(prisma.trustedDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fingerprintHash: expect.not.stringContaining("raw-fingerprint-value"),
        }),
      }),
    );
  });

  it("returns false for an untrusted fingerprint", async () => {
    const { service } = makeService({ device: null });
    await expect(service.isTrusted("user-1", "unknown")).resolves.toBe(false);
  });

  it("returns false for a revoked device", async () => {
    const { service } = makeService({
      device: { id: "dev-1", revokedAt: new Date(), expiresAt: new Date(Date.now() + 100000) },
    });
    await expect(service.isTrusted("user-1", "fp")).resolves.toBe(false);
  });

  it("returns false for an expired device", async () => {
    const { service } = makeService({
      device: { id: "dev-1", revokedAt: null, expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(service.isTrusted("user-1", "fp")).resolves.toBe(false);
  });

  it("returns true and touches lastSeenAt for a valid trusted device", async () => {
    const { service, prisma } = makeService({
      device: { id: "dev-1", revokedAt: null, expiresAt: new Date(Date.now() + 100000) },
    });
    await expect(service.isTrusted("user-1", "fp")).resolves.toBe(true);
    expect(prisma.trustedDevice.update).toHaveBeenCalledWith({
      where: { id: "dev-1" },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it("throws NotFoundException revoking another user's device", async () => {
    const { service } = makeService({ device: { id: "dev-1", userId: "other-user" } });
    await expect(service.revokeDevice("user-1", "dev-1")).rejects.toThrow(NotFoundException);
  });
});
