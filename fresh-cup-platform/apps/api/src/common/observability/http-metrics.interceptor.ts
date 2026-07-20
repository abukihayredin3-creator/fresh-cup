import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { tap } from "rxjs";
import { MetricsService } from "./metrics.service";

/** Route path, not the raw URL — keeps cardinality bounded (":id" not the actual UUID). */
function routeLabel(req: Request): string {
  const route = req.route as { path?: string } | undefined;
  return route?.path ?? req.path ?? "unknown";
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    const record = () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.recordHttpRequest(req.method, routeLabel(req), res.statusCode, durationSeconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
