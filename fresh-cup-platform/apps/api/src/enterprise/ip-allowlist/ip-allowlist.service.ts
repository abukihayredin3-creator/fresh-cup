import { Injectable, NotFoundException } from "@nestjs/common";
import type { IpAllowlistEntry } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CreateIpAllowlistEntryDto } from "./dto/create-ip-allowlist-entry.dto";
import { isIpInCidr } from "./ip-cidr.util";

/**
 * Org-level IP allowlisting — opt-in, not default-deny: an organization
 * with zero entries has no restriction (see the `IpAllowlistEntry`
 * schema docblock). `isAllowed()` is the enforcement point
 * `TenantContextGuard` calls on every tenant-scoped request once any
 * entry exists.
 */
@Injectable()
export class IpAllowlistService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<IpAllowlistEntry[]> {
    return this.prisma.ipAllowlistEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  create(organizationId: string, dto: CreateIpAllowlistEntryDto): Promise<IpAllowlistEntry> {
    return this.prisma.ipAllowlistEntry.create({ data: { organizationId, ...dto } });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const entry = await this.prisma.ipAllowlistEntry.findUnique({ where: { id } });
    if (!entry || entry.organizationId !== organizationId) {
      throw new NotFoundException("IP allowlist entry not found");
    }
    await this.prisma.ipAllowlistEntry.delete({ where: { id } });
  }

  async isAllowed(organizationId: string, ip: string | undefined): Promise<boolean> {
    const entries = await this.list(organizationId);
    if (entries.length === 0) {
      return true;
    }
    if (!ip) {
      return false;
    }
    return entries.some((entry) => isIpInCidr(ip, entry.cidr));
  }
}
