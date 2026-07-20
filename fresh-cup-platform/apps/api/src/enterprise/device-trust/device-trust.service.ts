import { NotFoundException, Injectable } from "@nestjs/common";
import type { TrustedDevice } from "@prisma/client";
import { sha256 } from "../../common/crypto/token.util";
import { PrismaService } from "../../database/prisma.service";
import type { TrustDeviceDto } from "./dto/trust-device.dto";

const DEFAULT_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Remember this device" — a trusted device is an additional MFA-bypass
 * signal a login flow can check, never an auth token itself (see the
 * `TrustedDevice` schema docblock). Only the fingerprint's hash is ever
 * persisted.
 */
@Injectable()
export class DeviceTrustService {
  constructor(private readonly prisma: PrismaService) {}

  async trustDevice(userId: string, dto: TrustDeviceDto): Promise<TrustedDevice> {
    const fingerprintHash = sha256(dto.fingerprint);
    const ttlDays = dto.ttlDays ?? DEFAULT_TTL_DAYS;
    const now = new Date();
    return this.prisma.trustedDevice.upsert({
      where: { userId_fingerprintHash: { userId, fingerprintHash } },
      create: {
        userId,
        fingerprintHash,
        deviceName: dto.deviceName,
        trustedAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + ttlDays * DAY_MS),
      },
      update: {
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + ttlDays * DAY_MS),
        revokedAt: null,
      },
    });
  }

  async isTrusted(userId: string, fingerprint: string): Promise<boolean> {
    const fingerprintHash = sha256(fingerprint);
    const device = await this.prisma.trustedDevice.findUnique({
      where: { userId_fingerprintHash: { userId, fingerprintHash } },
    });
    if (!device || device.revokedAt || device.expiresAt < new Date()) {
      return false;
    }
    await this.prisma.trustedDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    return true;
  }

  listDevices(userId: string): Promise<TrustedDevice[]> {
    return this.prisma.trustedDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.trustedDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== userId) {
      throw new NotFoundException("Trusted device not found");
    }
    await this.prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
  }
}
