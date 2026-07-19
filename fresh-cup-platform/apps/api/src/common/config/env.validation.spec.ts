import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const validConfig = {
    NODE_ENV: "development",
    PORT: "4000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/fresh_cup",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "test-secret-at-least-32-characters-long",
  };

  it("accepts a valid configuration", () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it("rejects a configuration missing DATABASE_URL", () => {
    const { DATABASE_URL: _omit, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment configuration/);
  });

  it("rejects an out-of-range PORT", () => {
    expect(() => validateEnv({ ...validConfig, PORT: "99999" })).toThrow();
  });

  it("rejects a configuration missing JWT_ACCESS_SECRET", () => {
    const { JWT_ACCESS_SECRET: _omit, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/Invalid environment configuration/);
  });

  it("defaults every Phase 7 AI provider/feature-flag var to a safe local fallback", () => {
    const result = validateEnv(validConfig);
    expect(result.LLM_PROVIDER).toBe("none");
    expect(result.EMBEDDING_PROVIDER).toBe("local");
    expect(result.VECTOR_PROVIDER).toBe("pgvector");
    expect(result.AI_MEMORY_ENABLED).toBe(true);
    expect(result.AI_RAG_ENABLED).toBe(false);
    expect(result.AI_EXECUTIVE_ENABLED).toBe(true);
    expect(result.AI_MARKETING_ENABLED).toBe(true);
    expect(result.AI_FORECASTING_ENABLED).toBe(true);
  });

  it("parses string 'true'/'false' AI feature flags from the environment correctly", () => {
    const result = validateEnv({
      ...validConfig,
      AI_RAG_ENABLED: "true",
      AI_MEMORY_ENABLED: "false",
    });
    expect(result.AI_RAG_ENABLED).toBe(true);
    expect(result.AI_MEMORY_ENABLED).toBe(false);
  });

  it("rejects an unknown LLM_PROVIDER value", () => {
    expect(() => validateEnv({ ...validConfig, LLM_PROVIDER: "not-a-real-provider" })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
