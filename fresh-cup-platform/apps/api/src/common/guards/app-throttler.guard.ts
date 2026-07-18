import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Rate limiting is real infrastructure to verify (see docs/ARCHITECTURE.md),
 * but a shared in-memory ThrottlerStorage across dozens of e2e tests in one
 * process/app instance would trip login limits that have nothing to do with
 * what each test is checking. Skipped only under NODE_ENV=test; dev/staging/
 * production always enforce it.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return process.env.NODE_ENV === "test";
  }
}
