import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const validConfig = {
    NODE_ENV: "development",
    PORT: "4000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/fresh_cup",
    REDIS_URL: "redis://localhost:6379",
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
});
