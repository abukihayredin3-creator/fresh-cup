import { isIpInCidr } from "./ip-cidr.util";

describe("isIpInCidr", () => {
  it("matches an IPv4 address within a /24", () => {
    expect(isIpInCidr("192.168.1.42", "192.168.1.0/24")).toBe(true);
  });

  it("rejects an IPv4 address outside a /24", () => {
    expect(isIpInCidr("192.168.2.42", "192.168.1.0/24")).toBe(false);
  });

  it("matches an exact /32", () => {
    expect(isIpInCidr("10.0.0.5", "10.0.0.5/32")).toBe(true);
    expect(isIpInCidr("10.0.0.6", "10.0.0.5/32")).toBe(false);
  });

  it("matches everything for a /0", () => {
    expect(isIpInCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
  });

  it("respects a narrow /30 boundary", () => {
    // 10.0.0.0/30 covers 10.0.0.0-10.0.0.3
    expect(isIpInCidr("10.0.0.3", "10.0.0.0/30")).toBe(true);
    expect(isIpInCidr("10.0.0.4", "10.0.0.0/30")).toBe(false);
  });

  it("treats a bare IP (no prefix) as a /32", () => {
    expect(isIpInCidr("10.0.0.5", "10.0.0.5")).toBe(true);
    expect(isIpInCidr("10.0.0.6", "10.0.0.5")).toBe(false);
  });

  it("matches an IPv6 address within a prefix", () => {
    expect(isIpInCidr("2001:db8::1", "2001:db8::/32")).toBe(true);
    expect(isIpInCidr("2001:db9::1", "2001:db8::/32")).toBe(false);
  });

  it("matches an exact IPv6 /128", () => {
    expect(isIpInCidr("::1", "::1/128")).toBe(true);
    expect(isIpInCidr("::2", "::1/128")).toBe(false);
  });

  it("returns false for malformed input rather than throwing", () => {
    expect(isIpInCidr("not-an-ip", "10.0.0.0/24")).toBe(false);
    expect(isIpInCidr("10.0.0.1", "not-a-cidr/24")).toBe(false);
  });
});
