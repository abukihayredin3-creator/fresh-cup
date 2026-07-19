import { SetMetadata } from "@nestjs/common";
import type { OrgRole } from "@prisma/client";

export const ORG_ROLES_KEY = "orgRoles";

/**
 * Restricts an endpoint to the given org-level roles. Requires
 * `TenantContextGuard` to run first (for `request.organizationId`) and
 * `OrgRolesGuard` to enforce it — see the OrgRole enum comment in
 * schema.prisma for why this is a second, additive role axis on top of
 * the existing branch-scoped `@Roles(...)`.
 */
export const OrgRoles = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);
