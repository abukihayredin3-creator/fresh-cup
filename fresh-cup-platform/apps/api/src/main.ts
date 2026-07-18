import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import type { EnvironmentVariables } from "./common/config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Fresh Cup API listening on port ${port}`);
}

bootstrap();
