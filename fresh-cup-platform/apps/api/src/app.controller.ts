import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { Public } from "./common/decorators/public.decorator";

@Controller()
export class AppController {
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  root() {
    return {
      name: "Fresh Cup API",
      status: "running",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };
  }
}
