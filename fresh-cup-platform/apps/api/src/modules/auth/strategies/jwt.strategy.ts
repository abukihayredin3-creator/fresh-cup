import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { AccessTokenPayload } from "../token.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  // Deliberately no DB lookup here: the access token is short-lived (see
  // JWT_ACCESS_TTL), so the staleness window for a deactivated/role-changed
  // user is bounded by design rather than paying a DB hit on every request.
  validate(payload: AccessTokenPayload): RequestUser {
    return { id: payload.sub, role: payload.role, branchId: payload.branchId };
  }
}
