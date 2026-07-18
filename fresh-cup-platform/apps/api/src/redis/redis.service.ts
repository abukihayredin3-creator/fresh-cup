import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { EnvironmentVariables } from "../common/config/env.validation";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  onModuleInit() {
    this.client = new Redis(this.config.get("REDIS_URL", { infer: true }), {
      maxRetriesPerRequest: 3,
    });
    this.client.on("error", (error) => this.logger.error(`Redis error: ${error.message}`));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }
}
