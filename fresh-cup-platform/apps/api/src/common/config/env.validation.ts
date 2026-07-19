import { plainToInstance } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from "class-validator";

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

  // --- Phase 6: AI assistant ---

  // Same "sandbox fallback when unset" pattern as CHAPA_SECRET_KEY: with no
  // key configured, AiAssistantService answers with deterministic templates
  // over the same real data instead of calling the Claude API.
  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  // --- Phase 7: Restaurant Intelligence Platform provider abstraction ---
  // Same "unset = safe local fallback" pattern used throughout this file:
  // every provider below defaults to a zero-external-dependency
  // implementation (NullLlmProvider / LocalEmbeddingProvider /
  // PgVectorProvider) so the platform works out of the box in dev/CI, and
  // switching to a real provider is a config change only — see
  // apps/api/src/intelligence/{llm,embeddings,vector}/*-provider.factory.ts.

  @IsOptional()
  @IsIn(["none", "anthropic", "openai", "azure-openai", "openrouter", "ollama", "gemini"])
  LLM_PROVIDER: string = "none";

  @IsOptional()
  @IsString()
  LLM_MODEL?: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  OPENAI_BASE_URL?: string;

  @IsOptional()
  @IsString()
  AZURE_OPENAI_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  AZURE_OPENAI_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  AZURE_OPENAI_DEPLOYMENT?: string;

  @IsOptional()
  @IsString()
  OPENROUTER_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  OPENROUTER_BASE_URL?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  OLLAMA_BASE_URL?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsIn(["local", "openai", "voyage", "cohere"])
  EMBEDDING_PROVIDER: string = "local";

  @IsOptional()
  @IsString()
  EMBEDDING_MODEL?: string;

  @IsOptional()
  @IsString()
  VOYAGE_API_KEY?: string;

  @IsOptional()
  @IsString()
  COHERE_API_KEY?: string;

  @IsOptional()
  @IsIn(["pgvector", "opensearch", "pinecone", "qdrant"])
  VECTOR_PROVIDER: string = "pgvector";

  @IsOptional()
  @IsUrl({ require_tld: false })
  OPENSEARCH_URL?: string;

  @IsOptional()
  @IsString()
  OPENSEARCH_API_KEY?: string;

  @IsOptional()
  @IsString()
  PINECONE_API_KEY?: string;

  @IsOptional()
  @IsString()
  PINECONE_INDEX_HOST?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  QDRANT_URL?: string;

  @IsOptional()
  @IsString()
  QDRANT_API_KEY?: string;

  @IsOptional()
  @IsBoolean()
  AI_MEMORY_ENABLED: boolean = true;

  // Off by default: retrieval only has something to retrieve once memory
  // entries have been embedded, which itself costs embedding-provider
  // calls — opt in once an embedding provider is actually configured.
  @IsOptional()
  @IsBoolean()
  AI_RAG_ENABLED: boolean = false;

  @IsOptional()
  @IsBoolean()
  AI_EXECUTIVE_ENABLED: boolean = true;

  @IsOptional()
  @IsBoolean()
  AI_MARKETING_ENABLED: boolean = true;

  @IsOptional()
  @IsBoolean()
  AI_FORECASTING_ENABLED: boolean = true;
}

/**
 * Boolean env vars arrive as the literal strings "true"/"false" (or are
 * absent). class-transformer's `enableImplicitConversion` would otherwise
 * coerce them via `Boolean(value)` — which makes the string "false"
 * truthy — so these are normalized to real booleans before plainToInstance
 * ever sees them.
 */
const BOOLEAN_ENV_KEYS = [
  "AI_MEMORY_ENABLED",
  "AI_RAG_ENABLED",
  "AI_EXECUTIVE_ENABLED",
  "AI_MARKETING_ENABLED",
  "AI_FORECASTING_ENABLED",
] as const;

function normalizeBooleanEnvVars(config: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...config };
  for (const key of BOOLEAN_ENV_KEYS) {
    const value = normalized[key];
    if (typeof value === "string") {
      normalized[key] = value === "true";
    }
  }
  return normalized;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, normalizeBooleanEnvVars(config), {
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
