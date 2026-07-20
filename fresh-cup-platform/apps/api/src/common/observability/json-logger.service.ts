import { Injectable, type LoggerService, type LogLevel } from "@nestjs/common";
import { RequestContextService } from "./request-context";

interface LogLine {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  traceId?: string;
  trace?: string;
}

/**
 * JSON-lines-to-stdout logging — the format log aggregators (Fluent
 * Bit/Loki/CloudWatch, see infra/observability/) expect to parse without
 * a regex. Hand-rolled rather than adding pino/winston: it's a small,
 * well-defined transform (build an object, JSON.stringify it), and this
 * platform only reaches for a new dependency when hand-rolling would
 * mean re-implementing something with real safety surface (parsers,
 * crypto) — plain structured logging isn't that.
 */
@Injectable()
export class JsonLoggerService implements LoggerService {
  constructor(private readonly requestContext: RequestContextService) {}

  log(message: unknown, context?: string): void {
    this.write("log", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write("verbose", message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const line: LogLine = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === "string" ? message : JSON.stringify(message),
      context,
      traceId: this.requestContext.getTraceId(),
      trace,
    };
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(line)}\n`);
  }
}
