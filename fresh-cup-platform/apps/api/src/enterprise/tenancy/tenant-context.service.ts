import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../../common/types/request-user.interface";

/**
 * Resolves the Organization (tenant) a request is acting within. This is
 * additive tenant scoping, not a retrofit of every existing table — see
 * docs/ROADMAP.md's Phase 8 Part 1 scope notes. Two resolution paths:
 *
 * 1. A branch-scoped user (the vast majority — staff/manager/admin with
 *    `branchId` set) always resolves to that branch's organization. They
 *    can never override it: a branch's tenant is fixed by construction.
 * 2. An org-level user with no branch (e.g. a franchise owner who isn't
 *    tied to one location) resolves via their OrganizationMembership
 *    rows. Exactly one membership resolves automatically; zero or
 *    multiple require the caller to pass `x-organization-id` explicitly
 *    (multiple memberships without a header is an ambiguous request, not
 *    a guess this service makes for you).
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveOrganizationId(actor: RequestUser, requestedOrgId?: string): Promise<string> {
    if (actor.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: actor.branchId },
        select: { organizationId: true },
      });
      if (!branch) {
        throw new ForbiddenException("Your branch could not be resolved to an organization");
      }
      if (requestedOrgId && requestedOrgId !== branch.organizationId) {
        throw new ForbiddenException("You cannot act outside your branch's organization");
      }
      return branch.organizationId;
    }

    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId: actor.id },
      select: { organizationId: true },
    });

    if (requestedOrgId) {
      if (!memberships.some((m) => m.organizationId === requestedOrgId)) {
        throw new ForbiddenException("You are not a member of that organization");
      }
      return requestedOrgId;
    }

    if (memberships.length === 1) {
      return memberships[0]!.organizationId;
    }
    if (memberships.length === 0) {
      throw new ForbiddenException("You do not belong to any organization");
    }
    throw new ForbiddenException(
      "You belong to multiple organizations — pass an x-organization-id header to disambiguate",
    );
  }
}
