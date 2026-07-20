import { Injectable } from "@nestjs/common";
import type { EnterpriseAuditLog, Prisma } from "@prisma/client";
import { sha256 } from "../../common/crypto/token.util";
import { PrismaService } from "../../database/prisma.service";

export interface ChainVerification {
  valid: boolean;
  brokenAtId?: string;
  entriesChecked: number;
}

/**
 * A hash-chained, append-only security audit trail — see the
 * `EnterpriseAuditLog` schema docblock for how it differs from Phase 3's
 * general `AuditLog`. Every row's `hash` commits to the previous row's
 * hash plus its own content, so `verifyChain()` can detect any row that
 * was altered or deleted after the fact, not just log that something
 * happened.
 */
@Injectable()
export class EnterpriseAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    organizationId: string,
    eventType: string,
    detail: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<EnterpriseAuditLog> {
    const last = await this.prisma.enterpriseAuditLog.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    const previousHash = last?.hash ?? null;
    const resolvedActorUserId = actorUserId ?? null;
    const hash = this.computeHash(
      organizationId,
      resolvedActorUserId,
      eventType,
      detail,
      previousHash,
    );

    return this.prisma.enterpriseAuditLog.create({
      data: {
        organizationId,
        actorUserId: resolvedActorUserId,
        eventType,
        detail: detail as Prisma.InputJsonValue,
        previousHash,
        hash,
      },
    });
  }

  list(organizationId: string, limit = 100): Promise<EnterpriseAuditLog[]> {
    return this.prisma.enterpriseAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async verifyChain(organizationId: string): Promise<ChainVerification> {
    const logs = await this.prisma.enterpriseAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });

    let previousHash: string | null = null;
    for (const log of logs) {
      const expected = this.computeHash(
        organizationId,
        log.actorUserId,
        log.eventType,
        log.detail as Record<string, unknown>,
        previousHash,
      );
      if (expected !== log.hash || log.previousHash !== previousHash) {
        return { valid: false, brokenAtId: log.id, entriesChecked: logs.length };
      }
      previousHash = log.hash;
    }
    return { valid: true, entriesChecked: logs.length };
  }

  private computeHash(
    organizationId: string,
    actorUserId: string | null,
    eventType: string,
    detail: Record<string, unknown>,
    previousHash: string | null,
  ): string {
    const canonical = JSON.stringify({
      organizationId,
      actorUserId,
      eventType,
      detail,
      previousHash,
    });
    return sha256(canonical);
  }
}
