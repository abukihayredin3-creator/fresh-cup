import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";

/**
 * Resolves which branch id(s) an AI Brain engine may query for a given
 * organization. Shared by every engine that scopes a Prisma query by
 * branch (Prediction/Reasoning/Decision) so the tenant-isolation check —
 * a caller-supplied branchId must actually belong to the resolved
 * organization, never just "any branch id" — lives in exactly one,
 * auditable place instead of being re-implemented per engine.
 */
@Injectable()
export class AiBrainTenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveBranchIds(organizationId: string, branchId?: string): Promise<string[]> {
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, organizationId },
        select: { id: true },
      });
      if (!branch) {
        throw new NotFoundException(`Branch ${branchId} not found in this organization`);
      }
      return [branch.id];
    }

    const branches = await this.prisma.branch.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return branches.map((b) => b.id);
  }
}
