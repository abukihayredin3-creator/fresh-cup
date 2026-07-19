import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { AiSecurityService } from "../services/ai-security.service";

/**
 * Belt-and-suspenders response guard for every AI controller: recursively
 * scrubs secret-shaped substrings from the outgoing JSON body. In normal
 * operation this never changes anything (tool results only ever carry
 * business data), but it means a bug that accidentally surfaces a
 * credential can't reach a client unredacted.
 */
@Injectable()
export class SecretRedactionInterceptor implements NestInterceptor {
  constructor(private readonly security: AiSecurityService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body: unknown) => this.security.redactDeep(body)));
  }
}
