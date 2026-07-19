import { of } from "rxjs";
import { AiSecurityService } from "../services/ai-security.service";
import { SecretRedactionInterceptor } from "./secret-redaction.interceptor";

describe("SecretRedactionInterceptor", () => {
  it("redacts secret-shaped strings anywhere in the response body", (done) => {
    const interceptor = new SecretRedactionInterceptor(new AiSecurityService());
    const body = { answer: "key: sk-ant-abcdefghijklmnopqrstuvwx", nested: { ok: true } };

    interceptor.intercept({} as never, { handle: () => of(body) } as never).subscribe((result) => {
      expect((result as typeof body).answer).toBe("key: [REDACTED]");
      expect((result as typeof body).nested).toEqual({ ok: true });
      done();
    });
  });
});
