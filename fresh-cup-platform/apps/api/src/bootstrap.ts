import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./common/config/env.validation";

/**
 * Application wiring shared between the real server (main.ts) and e2e
 * tests, so tests exercise the exact same validation/prefix/CORS behavior
 * production traffic hits — not a hand-rolled approximation of it.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: [
      config.get("WEB_APP_URL", { infer: true }),
      config.get("ADMIN_APP_URL", { infer: true }),
      config.get("DELIVERY_APP_URL", { infer: true }),
    ].filter((origin): origin is string => Boolean(origin)),
    credentials: true,
  });

  app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
}
