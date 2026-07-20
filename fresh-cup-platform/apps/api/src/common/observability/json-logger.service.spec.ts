import type { RequestContextService } from "./request-context";
import { JsonLoggerService } from "./json-logger.service";

describe("JsonLoggerService", () => {
  function makeLogger(traceId: string | undefined) {
    const requestContext = {
      getTraceId: jest.fn().mockReturnValue(traceId),
    } as unknown as jest.Mocked<RequestContextService>;
    return new JsonLoggerService(requestContext);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes a JSON line to stdout with the current traceId", () => {
    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = makeLogger("trace-123");
    logger.log("hello", "TestContext");

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse((writeSpy.mock.calls[0]![0] as string).trim());
    expect(parsed).toMatchObject({
      level: "log",
      message: "hello",
      context: "TestContext",
      traceId: "trace-123",
    });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("routes error-level logs to stderr and includes the trace string", () => {
    const writeSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = makeLogger(undefined);
    logger.error("boom", "stack-trace-text", "TestContext");

    const parsed = JSON.parse((writeSpy.mock.calls[0]![0] as string).trim());
    expect(parsed).toMatchObject({ level: "error", message: "boom", trace: "stack-trace-text" });
  });

  it("stringifies non-string messages", () => {
    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = makeLogger(undefined);
    logger.log({ code: 42 });

    const parsed = JSON.parse((writeSpy.mock.calls[0]![0] as string).trim());
    expect(parsed.message).toBe(JSON.stringify({ code: 42 }));
  });
});
