import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { IpAllowlistService } from "../ip-allowlist/ip-allowlist.service";
import { TenantContextService } from "./tenant-context.service";
import "./request-organization.interface";

/**
 * Resolves the acting Organization and attaches it to `request.organizationId`
 * for `@CurrentOrganization()` to read. Applied explicitly via
 * `@UseGuards(TenantContextGuard)` on enterprise-scoped controllers rather
 * than globally — it runs after the global JwtAuthGuard/RolesGuard, so
 * `request.user` is always populated by the time it runs.
 *
 * Also enforces the organization's IP allowlist (opt-in — see
 * `IpAllowlistService`), since every enterprise-scoped request already
 * passes through here anyway; there's no reason to duplicate that check
 * in a second guard every enterprise controller would also need.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly ipAllowlist: IpAllowlistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestedOrgId = request.headers["x-organization-id"];
    const organizationId = await this.tenantContext.resolveOrganizationId(
      request.user!,
      typeof requestedOrgId === "string" ? requestedOrgId : undefined,
    );

    const allowed = await this.ipAllowlist.isAllowed(organizationId, request.ip);
    if (!allowed) {
      throw new ForbiddenException("Your IP address is not on this organization's allowlist");
    }

    request.organizationId = organizationId;
    return true;
  }
}
