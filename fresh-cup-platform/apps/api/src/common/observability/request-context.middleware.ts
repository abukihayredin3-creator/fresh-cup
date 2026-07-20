import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { RequestContextService } from "./request-context";

const TRACE_HEADER = "x-trace-id";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header(TRACE_HEADER);
    const traceId = inbound && inbound.length > 0 ? inbound : randomUUID();
    res.setHeader(TRACE_HEADER, traceId);
    this.requestContext.run({ traceId }, next);
  }
}
