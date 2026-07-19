import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import "./request-organization.interface";

/** Injects the resolved organization id set by TenantContextGuard. */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.organizationId!;
  },
);
