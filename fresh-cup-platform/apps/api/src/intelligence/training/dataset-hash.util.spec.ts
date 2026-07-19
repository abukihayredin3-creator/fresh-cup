import { hashDataset } from "./dataset-hash.util";

describe("hashDataset", () => {
  it("is deterministic — the same input always hashes the same", () => {
    expect(hashDataset("a:100:2026-01-01")).toBe(hashDataset("a:100:2026-01-01"));
  });

  it("produces different hashes for different input", () => {
    expect(hashDataset("a:100")).not.toBe(hashDataset("a:101"));
  });

  it("returns an 8-character hex string", () => {
    expect(hashDataset("anything")).toMatch(/^[0-9a-f]{8}$/);
  });
});
