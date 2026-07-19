import { Module } from "@nestjs/common";
import { TenantContextGuard } from "./tenant-context.guard";
import { TenantContextService } from "./tenant-context.service";

/**
 * A small standalone module for `TenantContextService`/`TenantContextGuard`
 * so any module that needs to resolve "which organization is this request
 * acting within" (e.g. BranchesModule, which now writes `organizationId`
 * on create) can import just this rather than the full EnterpriseModule.
 */
@Module({
  providers: [TenantContextService, TenantContextGuard],
  exports: [TenantContextService, TenantContextGuard],
})
export class TenancyModule {}
