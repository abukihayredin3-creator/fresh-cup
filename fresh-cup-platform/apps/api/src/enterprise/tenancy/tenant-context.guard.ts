import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { TenantContextService } from "./tenant-context.service";
import "./request-organization.interface";

/**
 * Resolves the acting Organization and attaches it to `request.organizationId`
 * for `@CurrentOrganization()` to read. Applied explicitly via
 * `@UseGuards(TenantContextGuard)` on enterprise-scoped controllers rather
 * than globally — it runs after the global JwtAuthGuard/RolesGuard, so
 * `request.user` is always populated by the time it runs.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestedOrgId = request.headers["x-organization-id"];
    const organizationId = await this.tenantContext.resolveOrganizationId(
      request.user!,
      typeof requestedOrgId === "string" ? requestedOrgId : undefined,
    );
    request.organizationId = organizationId;
    return true;
  }
}
