import { Injectable } from "@nestjs/common";
import type { GlobalConfigEntry, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

/**
 * Tenant-scoped key-value configuration (branding, defaults, integration
 * settings). Deliberately untyped JSON values — see the schema.prisma
 * docblock on `GlobalConfigEntry` for why a column-per-setting table
 * would defeat the point of an open-ended config service.
 */
@Injectable()
export class GlobalConfigService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<GlobalConfigEntry[]> {
    return this.prisma.globalConfigEntry.findMany({
      where: { organizationId },
      orderBy: { key: "asc" },
    });
  }

  async get(organizationId: string, key: string): Promise<unknown | undefined> {
    const entry = await this.prisma.globalConfigEntry.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    return entry?.value;
  }

  set(organizationId: string, key: string, value: unknown): Promise<GlobalConfigEntry> {
    return this.prisma.globalConfigEntry.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  async delete(organizationId: string, key: string): Promise<void> {
    await this.prisma.globalConfigEntry.deleteMany({ where: { organizationId, key } });
  }
}
