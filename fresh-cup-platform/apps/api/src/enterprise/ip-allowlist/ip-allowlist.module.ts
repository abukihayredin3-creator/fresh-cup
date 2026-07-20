import { Module } from "@nestjs/common";
import { IpAllowlistService } from "./ip-allowlist.service";

/**
 * Deliberately has NO controller here, even though `IpAllowlistController`
 * lives in this directory — `TenantContextGuard` (in `TenancyModule`)
 * depends on `IpAllowlistService`, so `TenancyModule` imports this module.
 * If `IpAllowlistController` (which itself uses `TenantContextGuard`) were
 * registered here too, that would create a module import cycle
 * (TenancyModule -> IpAllowlistModule -> needs TenancyModule's guard).
 * `IpAllowlistController` is registered directly on `EnterpriseModule`
 * instead, which already imports both `TenancyModule` and this module.
 */
@Module({
  providers: [IpAllowlistService],
  exports: [IpAllowlistService],
})
export class IpAllowlistModule {}
