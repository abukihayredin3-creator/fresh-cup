import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from "class-validator";

export enum NodeEnv {
  Development = "development",
  Test = "test",
  Staging = "staging",
  Production = "production",
}

/**
 * Every environment variable the API depends on, validated at boot.
 * A misconfigured environment should fail immediately and loudly,
 * not surface as a confusing runtime error three requests later.
 */
export class EnvironmentVariables {
  @IsIn(Object.values(NodeEnv))
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  WEB_APP_URL?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  ADMIN_APP_URL?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  DELIVERY_APP_URL?: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = "15m";

  @IsOptional()
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS: number = 30;

  @IsOptional()
  @IsInt()
  @Min(1)
  OTP_TTL_MINUTES: number = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPTS: number = 5;

  // --- Phase 2: ordering, payments, loyalty ---

  @IsOptional()
  @IsString()
  CHAPA_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  CHAPA_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  CHAPA_BASE_URL: string = "https://api.chapa.co/v1";

  @IsOptional()
  @IsUrl({ require_tld: false })
  CHAPA_RETURN_URL?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  CHAPA_CALLBACK_URL?: string;

  // MVP flat rate in minor units (ETB cents); zone/distance-based fee
  // quoting is Phase 3 (Delivery & real-time).
  @IsOptional()
  @IsInt()
  @Min(0)
  DELIVERY_FLAT_FEE: number = 5000;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  TAX_RATE_PERCENT: number = 0;

  // Points earned = floor(order.total / this value). Default: 1 point per
  // 10 ETB spent.
  @IsOptional()
  @IsInt()
  @Min(1)
  LOYALTY_MINOR_UNITS_PER_POINT: number = 1000;

  // *_SEED_EMAIL / *_SEED_PASSWORD (ADMIN/MANAGER/STAFF) are read directly
  // from process.env by prisma/seed.ts, a standalone script the running API
  // never touches — they're intentionally not part of this class.
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(", "))
      .join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  return validated;
}
