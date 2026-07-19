import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

export const REQUIRES_AI_AUTHORIZATION_KEY = "requiresAiAuthorization";

/**
 * Marks an endpoint as performing an action the AI platform must never
 * take on its own (Core Principle: "It should not autonomously perform
 * irreversible actions ... without explicit authorization"). No Phase 7
 * Part 1 endpoint is destructive yet — every domain AI service only
 * forecasts/recommends/summarizes/explains — but this decorator + guard
 * exist as the enforcement point for the action-taking endpoints a later
 * phase adds (e.g. "apply this reorder", "send this campaign").
 */
export const RequireAiAuthorization = () => SetMetadata(REQUIRES_AI_AUTHORIZATION_KEY, true);

/**
 * Requires an explicit `x-ai-action-confirmed: true` header on top of
 * normal auth/RBAC — a human in the loop has to affirmatively confirm the
 * action on every call, it's never inferred from a prior request.
 */
@Injectable()
export class AiAuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresAuthorization = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_AI_AUTHORIZATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresAuthorization) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const confirmed = request.headers["x-ai-action-confirmed"] === "true";
    if (!confirmed) {
      throw new ForbiddenException(
        "This action requires explicit human authorization — resend with the x-ai-action-confirmed header set to 'true'.",
      );
    }
    return true;
  }
}
