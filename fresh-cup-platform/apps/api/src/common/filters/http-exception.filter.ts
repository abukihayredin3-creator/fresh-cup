import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import type { ProblemDetails } from "@fresh-cup/types";

/**
 * Converts every thrown error into an RFC 7807 `application/problem+json`
 * body — see docs/API_DESIGN.md. Applied globally so every controller gets
 * a consistent error shape without repeating try/catch boilerplate.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, title, detail } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ProblemDetails = {
      type: `https://freshcup.dev/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
    };

    response.status(status).contentType("application/problem+json").send(body);
  }

  private resolve(exception: unknown): { status: number; title: string; detail: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === "string"
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        title: HttpStatus[status] ?? "Error",
        detail: Array.isArray(detail) ? detail.join("; ") : detail,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: "Internal Server Error",
      detail: "An unexpected error occurred",
    };
  }

  private resolvePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    title: string;
    detail: string;
  } {
    switch (exception.code) {
      case "P2002": {
        const target = (exception.meta?.target as string[] | undefined)?.join(", ") ?? "field";
        return {
          status: HttpStatus.CONFLICT,
          title: "Conflict",
          detail: `A record with this ${target} already exists`,
        };
      }
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          title: "Not Found",
          detail: "The requested resource does not exist",
        };
      case "P2003":
        return {
          status: HttpStatus.BAD_REQUEST,
          title: "Bad Request",
          detail: "This operation references a resource that does not exist",
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          title: "Internal Server Error",
          detail: "An unexpected database error occurred",
        };
    }
  }
}
