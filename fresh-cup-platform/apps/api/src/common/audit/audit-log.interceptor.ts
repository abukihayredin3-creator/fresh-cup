import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../types/request-user.interface";
import { AUDIT_ENTITY_TYPE_KEY, AUDIT_INCLUDE_READS_KEY } from "./auditable.decorator";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Writes one AuditLog row per mutating request on a controller/handler
 * tagged `@Auditable(entityType)`. Fire-and-forget (doesn't block or fail
 * the response if the write fails) — audit logging is a secondary concern,
 * never a reason to break a real mutation.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ENTITY_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!entityType || context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const includeReads = this.reflector.getAllAndOverride<boolean | undefined>(
      AUDIT_INCLUDE_READS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const isAuditable =
      MUTATING_METHODS.has(request.method) || (includeReads === true && request.method === "GET");
    if (!isAuditable) {
      return next.handle();
    }

    const actor = request.user as RequestUser | undefined;
    const action = `${request.method} ${request.route?.path ?? request.path}`;

    return next.handle().pipe(
      tap((result: unknown) => {
        const entityId = this.extractEntityId(result, request);
        this.prisma.auditLog
          .create({
            data: {
              actorUserId: actor?.id ?? null,
              action,
              entityType,
              entityId,
              after: this.toJson(result, request.method),
            },
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Failed to write audit log for ${action}: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
      }),
    );
  }

  private extractEntityId(result: unknown, request: Request): string | null {
    if (
      result &&
      typeof result === "object" &&
      "id" in result &&
      typeof (result as { id: unknown }).id === "string"
    ) {
      return (result as { id: string }).id;
    }
    const paramId = request.params?.id;
    return typeof paramId === "string" ? paramId : null;
  }

  private toJson(result: unknown, method: string): Prisma.InputJsonValue | undefined {
    if (result === undefined || result === null) {
      return method === "DELETE" ? { deleted: true } : undefined;
    }
    try {
      return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    } catch {
      return undefined;
    }
  }
}
