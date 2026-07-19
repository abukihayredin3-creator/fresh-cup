import { PromptRegistryService } from "./prompt-registry.service";

describe("PromptRegistryService", () => {
  it("lists a record for every domain with a stable fingerprint", () => {
    const service = new PromptRegistryService();
    const records = service.list();

    expect(records.length).toBeGreaterThanOrEqual(8);
    for (const record of records) {
      expect(record.prompt.length).toBeGreaterThan(0);
      expect(record.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("produces the same fingerprint on repeated calls (deterministic)", () => {
    const service = new PromptRegistryService();
    const first = service.list();
    const second = service.list();
    expect(first.map((r) => r.fingerprint)).toEqual(second.map((r) => r.fingerprint));
  });
});
