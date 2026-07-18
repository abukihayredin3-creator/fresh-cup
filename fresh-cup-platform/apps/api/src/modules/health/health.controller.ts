import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { RedisService } from "../../redis/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {
      status: "ok",
      service: "fresh-cup-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async readiness() {
    const [database, redis] = await Promise.all([this.prisma.isHealthy(), this.redis.isHealthy()]);

    const healthy = database && redis;
    const body = {
      status: healthy ? "ok" : "degraded",
      dependencies: { database, redis },
      timestamp: new Date().toISOString(),
    };

    if (!healthy) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }
}
