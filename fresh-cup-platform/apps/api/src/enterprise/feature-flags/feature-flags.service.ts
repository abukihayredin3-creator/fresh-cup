import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { FeatureFlagDefinition, FeatureFlagOverride } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { hashDataset } from "../../intelligence/training/dataset-hash.util";
import type { CreateFeatureFlagDefinitionDto } from "./dto/create-feature-flag-definition.dto";
import type { SetFeatureFlagOverrideDto } from "./dto/set-feature-flag-override.dto";

/**
 * Feature flags. Resolution order for `evaluate()`:
 *   1. A branch-specific FeatureFlagOverride for this org, if one exists.
 *   2. An org-wide FeatureFlagOverride (branchId null), if one exists.
 *   3. The FeatureFlagDefinition's `defaultEnabled`.
 * An unknown key resolves to `false` — fail closed rather than silently
 * turning on a feature no definition documents.
 *
 * A partial rollout (`rolloutPercentage` on an `enabled: true` override) is
 * deterministic, not randomized per request: the entity id (branch, or the
 * organization when the override is org-wide) is hashed with the same
 * FNV-1a utility Part 2's training pipeline uses for dataset fingerprints,
 * so the same branch always lands on the same side of the rollout line.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  listDefinitions(): Promise<FeatureFlagDefinition[]> {
    return this.prisma.featureFlagDefinition.findMany({ orderBy: { key: "asc" } });
  }

  async createDefinition(dto: CreateFeatureFlagDefinitionDto): Promise<FeatureFlagDefinition> {
    const existing = await this.prisma.featureFlagDefinition.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`Feature flag '${dto.key}' already exists`);
    }
    return this.prisma.featureFlagDefinition.create({ data: dto });
  }

  listOverrides(organizationId: string): Promise<FeatureFlagOverride[]> {
    return this.prisma.featureFlagOverride.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async setOverride(
    organizationId: string,
    key: string,
    dto: SetFeatureFlagOverrideDto,
  ): Promise<FeatureFlagOverride> {
    const definition = await this.findDefinitionOrThrow(key);
    return this.prisma.featureFlagOverride.upsert({
      where: {
        organizationId_featureFlagId_branchId: {
          organizationId,
          featureFlagId: definition.id,
          branchId: (dto.branchId ?? null) as unknown as string,
        },
      },
      create: {
        organizationId,
        featureFlagId: definition.id,
        branchId: dto.branchId,
        enabled: dto.enabled,
        rolloutPercentage: dto.rolloutPercentage,
      },
      update: {
        enabled: dto.enabled,
        rolloutPercentage: dto.rolloutPercentage,
      },
    });
  }

  async evaluate(organizationId: string, key: string, branchId?: string): Promise<boolean> {
    const definition = await this.prisma.featureFlagDefinition.findUnique({ where: { key } });
    if (!definition) {
      return false;
    }

    const branchOverride = branchId
      ? await this.prisma.featureFlagOverride.findUnique({
          where: {
            organizationId_featureFlagId_branchId: {
              organizationId,
              featureFlagId: definition.id,
              branchId,
            },
          },
        })
      : null;

    const orgOverride = branchOverride
      ? null
      : await this.prisma.featureFlagOverride.findUnique({
          where: {
            organizationId_featureFlagId_branchId: {
              organizationId,
              featureFlagId: definition.id,
              branchId: null as unknown as string,
            },
          },
        });

    const override = branchOverride ?? orgOverride;
    if (!override) {
      return definition.defaultEnabled;
    }
    if (!override.enabled) {
      return false;
    }
    if (override.rolloutPercentage == null) {
      return true;
    }

    const entityId = branchId ?? organizationId;
    const bucket = parseInt(hashDataset(`${key}:${entityId}`), 16) % 100;
    return bucket < override.rolloutPercentage;
  }

  private async findDefinitionOrThrow(key: string): Promise<FeatureFlagDefinition> {
    const definition = await this.prisma.featureFlagDefinition.findUnique({ where: { key } });
    if (!definition) {
      throw new NotFoundException(`Feature flag '${key}' is not defined`);
    }
    return definition;
  }
}
