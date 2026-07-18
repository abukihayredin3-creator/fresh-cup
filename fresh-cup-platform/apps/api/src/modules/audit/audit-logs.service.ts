import { Injectable } from "@nestjs/common";
import type { AuditLog, Prisma } from "@prisma/client";
import { paginate } from "../../common/pagination/paginate";
import { PrismaService } from "../../database/prisma.service";
import type { AuditLogResponseDto } from "./dto/audit-log-response.dto";
import type { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType,
      actorUserId: query.actorUserId,
      entityId: query.entityId,
    };

    return paginate<AuditLog>(
      (page) =>
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  toResponse(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      actorUserId: log.actorUserId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      after: log.after,
      createdAt: log.createdAt,
    };
  }
}
