import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { RegionalPriceOverride } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { SetRegionalPriceDto } from "./dto/set-regional-price.dto";

/**
 * Overrides `MenuItem.basePrice` per region — e.g. a coastal region with
 * higher import costs pricing the same drink higher than the org's
 * default. `resolveEffectivePrice()` is the lookup a checkout/menu-read
 * path would call: override if one exists for the region, otherwise the
 * item's org-wide base price.
 */
@Injectable()
export class RegionalPricingService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string, regionId: string): Promise<RegionalPriceOverride[]> {
    return this.assertRegionInOrg(organizationId, regionId).then(() =>
      this.prisma.regionalPriceOverride.findMany({
        where: { regionId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async setOverride(
    organizationId: string,
    regionId: string,
    dto: SetRegionalPriceDto,
  ): Promise<RegionalPriceOverride> {
    await this.assertRegionInOrg(organizationId, regionId);
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: dto.menuItemId },
      include: { branch: true },
    });
    if (!menuItem || menuItem.branch.organizationId !== organizationId) {
      throw new NotFoundException("Menu item not found");
    }

    return this.prisma.regionalPriceOverride.upsert({
      where: { regionId_menuItemId: { regionId, menuItemId: dto.menuItemId } },
      create: { regionId, menuItemId: dto.menuItemId, priceMinor: dto.priceMinor },
      update: { priceMinor: dto.priceMinor },
    });
  }

  async removeOverride(
    organizationId: string,
    regionId: string,
    menuItemId: string,
  ): Promise<void> {
    await this.assertRegionInOrg(organizationId, regionId);
    await this.prisma.regionalPriceOverride
      .delete({ where: { regionId_menuItemId: { regionId, menuItemId } } })
      .catch(() => undefined);
  }

  async resolveEffectivePrice(menuItemId: string, regionId: string | null): Promise<number> {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }
    if (!regionId) {
      return menuItem.basePrice;
    }
    const override = await this.prisma.regionalPriceOverride.findUnique({
      where: { regionId_menuItemId: { regionId, menuItemId } },
    });
    return override?.priceMinor ?? menuItem.basePrice;
  }

  private async assertRegionInOrg(organizationId: string, regionId: string): Promise<void> {
    const region = await this.prisma.region.findUnique({ where: { id: regionId } });
    if (!region || region.organizationId !== organizationId) {
      throw new ForbiddenException("That region does not belong to your organization");
    }
  }
}
