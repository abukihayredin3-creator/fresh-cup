import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./bootstrap";
import type { EnvironmentVariables } from "./common/config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get(ConfigService<EnvironmentVariables, true>);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Fresh Cup API")
    .setDescription(
      "Fresh Cup Juice House — core API. See fresh-cup-platform/docs/API_DESIGN.md for conventions.",
    )
    .setVersion("1")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Fresh Cup API listening on port ${port}`);
}

bootstrap();
