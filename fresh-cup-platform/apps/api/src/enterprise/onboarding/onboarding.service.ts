import { ConflictException, Injectable } from "@nestjs/common";
import { OrgRole, UserRole } from "@prisma/client";
import { hashPassword } from "../../common/crypto/password.util";
import { PrismaService } from "../../database/prisma.service";
import type { OnboardTenantDto } from "./dto/onboard-tenant.dto";
import type { OnboardTenantResponseDto } from "./dto/onboard-tenant-response.dto";

/**
 * Tenant onboarding — creates a brand-new Organization, its first Branch,
 * and an owner-level admin User, atomically. "Wizard" here means the
 * guided sequence of steps a real UI would walk an operator through
 * (organization details → branch details → owner account), performed as
 * one atomic transaction rather than a persisted multi-request form flow
 * — this codebase has no session-backed multi-step form state mechanism,
 * and splitting tenant creation across multiple unauthenticated requests
 * would leave a half-created organization if the caller never returns for
 * step 2. `apps/admin`'s onboarding page presents this as a multi-step UI
 * that only submits once every step's inputs are collected.
 */
@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async onboard(dto: OnboardTenantDto): Promise<OnboardTenantResponseDto> {
    const existingSlug = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (existingSlug) {
      throw new ConflictException(`Organization slug '${dto.organizationSlug}' is already taken`);
    }
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existingEmail) {
      throw new ConflictException(`Email '${dto.adminEmail}' is already registered`);
    }

    const passwordHash = await hashPassword(dto.adminPassword);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug: dto.organizationSlug,
          timezone: dto.timezone ?? "Africa/Addis_Ababa",
          defaultCurrencyCode: dto.defaultCurrencyCode ?? "ETB",
        },
      });

      const branch = await tx.branch.create({
        data: {
          name: dto.branchName,
          addressText: dto.branchAddressText,
          organizationId: organization.id,
        },
      });

      const admin = await tx.user.create({
        data: {
          email: dto.adminEmail,
          passwordHash,
          fullName: dto.adminFullName,
          role: UserRole.ADMIN,
          isOwner: true,
          branchId: branch.id,
        },
      });

      await tx.organizationMembership.create({
        data: { organizationId: organization.id, userId: admin.id, role: OrgRole.ORG_OWNER },
      });

      await tx.organization.update({
        where: { id: organization.id },
        data: { onboardingCompletedAt: new Date() },
      });

      return {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        branchId: branch.id,
        adminUserId: admin.id,
      };
    });
  }
}
