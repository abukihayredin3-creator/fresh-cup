import { Injectable, NotFoundException } from "@nestjs/common";
import type { Organization } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { OrganizationResponseDto } from "./dto/organization-response.dto";
import type { UpdateOrganizationDto } from "./dto/update-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({ where: { id } });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    await this.findByIdOrThrow(id);
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async toResponse(organization: Organization): Promise<OrganizationResponseDto> {
    const branchCount = await this.prisma.branch.count({
      where: { organizationId: organization.id },
    });
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      domain: organization.domain,
      status: organization.status,
      timezone: organization.timezone,
      defaultLocale: organization.defaultLocale,
      defaultCurrencyCode: organization.defaultCurrencyCode,
      onboardingCompletedAt: organization.onboardingCompletedAt,
      branchCount,
    };
  }
}
