import { haversineKm } from "./haversine";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(9.0157, 38.7369, 9.0157, 38.7369)).toBe(0);
  });

  it("computes a known distance (Addis Ababa Bole to Merkato, ~4.5km)", () => {
    // Bole: 8.9806, 38.7578 — Merkato: 9.0157, 38.7369
    const distance = haversineKm(8.9806, 38.7578, 9.0157, 38.7369);
    expect(distance).toBeGreaterThan(4);
    expect(distance).toBeLessThan(5);
  });

  it("is symmetric", () => {
    const a = haversineKm(9.0157, 38.7369, 9.03, 38.75);
    const b = haversineKm(9.03, 38.75, 9.0157, 38.7369);
    expect(a).toBeCloseTo(b, 10);
  });
});
