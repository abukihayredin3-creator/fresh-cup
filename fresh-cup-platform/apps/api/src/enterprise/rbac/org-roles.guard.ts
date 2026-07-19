import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole, type OrgRole } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../database/prisma.service";
import { ORG_ROLES_KEY } from "./org-roles.decorator";
import "../tenancy/request-organization.interface";

/**
 * Enforces `@OrgRoles(...)` metadata against the actor's
 * OrganizationMembership in `request.organizationId` (set by
 * TenantContextGuard, which must run first). A platform `UserRole.ADMIN`
 * account always passes — same ADMIN-bypasses-scoping precedent as
 * `assertBranchAccess` — since an admin's existing branch-scoped access
 * is already a superset of any org-level grant this phase adds.
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const actor = request.user!;
    if (actor.role === UserRole.ADMIN) {
      return true;
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: request.organizationId!, userId: actor.id },
      },
      select: { role: true },
    });

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException("You do not have the required organization role");
    }
    return true;
  }
}
