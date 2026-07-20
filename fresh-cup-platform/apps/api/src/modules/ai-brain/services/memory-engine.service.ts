import { Injectable } from "@nestjs/common";
import type { AiMemory, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@fresh-cup/types";
import { paginate } from "../../../common/pagination/paginate";
import { PrismaService } from "../../../database/prisma.service";
import type { MemoryEventInput, MemoryQuery } from "../interfaces/ai-brain.interfaces";

/**
 * Long-term restaurant intelligence memory: business events and AI
 * observations (see AiMemory in schema.prisma), org-scoped and optionally
 * branch-scoped, retrievable by recency and importance. Every other AI
 * Brain engine reads through this service rather than querying
 * `prisma.aiMemory` directly, so memory persistence stays swappable
 * (e.g. behind a vector store later) without touching the callers.
 */
@Injectable()
export class MemoryEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async record(organizationId: string, input: MemoryEventInput): Promise<AiMemory> {
    return this.prisma.aiMemory.create({
      data: {
        organizationId,
        branchId: input.branchId ?? undefined,
        memoryType: input.memoryType,
        data: input.data as Prisma.InputJsonValue,
        importance: input.importance ?? 0.5,
      },
    });
  }

  async recall(organizationId: string, query: MemoryQuery): Promise<PaginatedResult<AiMemory>> {
    return paginate(
      (pageArgs) =>
        this.prisma.aiMemory.findMany({
          where: {
            organizationId,
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.memoryType ? { memoryType: query.memoryType } : {}),
            ...(query.minImportance !== undefined
              ? { importance: { gte: query.minImportance } }
              : {}),
          },
          orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
          ...pageArgs,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  /** The highest-importance recent memories — what the other engines "recall" first. */
  async mostImportant(organizationId: string, branchId?: string, take = 20): Promise<AiMemory[]> {
    return this.prisma.aiMemory.findMany({
      where: { organizationId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take,
    });
  }

  async findByType(
    organizationId: string,
    memoryType: string,
    branchId?: string,
    take = 50,
  ): Promise<AiMemory[]> {
    return this.prisma.aiMemory.findMany({
      where: { organizationId, memoryType, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
