/**
 * Hand-rolled CIDR matching — pure integer arithmetic, no parsing-safety
 * concerns like the XML/CBOR paths elsewhere in this module, so there's
 * no scope-boundary reason to reach for a library here.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = (result << 8) | octet;
  }
  return result >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  // Minimal support: expands "::" once, rejects embedded IPv4 tails and
  // zone IDs — good enough for the allowlist's own equality/prefix checks,
  // not a general-purpose IPv6 parser.
  if (!ip.includes(":")) return null;
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  if (ip.includes("::")) {
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    const groups = [...headParts, ...Array(missing).fill("0"), ...tailParts];
    return groupsToBigInt(groups);
  }
  const groups = ip.split(":");
  if (groups.length !== 8) return null;
  return groupsToBigInt(groups);
}

function groupsToBigInt(groups: string[]): bigint | null {
  if (groups.length !== 8) return null;
  let result = 0n;
  for (const group of groups) {
    const value = parseInt(group || "0", 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) return null;
    result = (result << 16n) | BigInt(value);
  }
  return result;
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split("/");
  if (!network) return false;
  const prefix = prefixStr === undefined ? undefined : Number(prefixStr);

  const isV4 = network.includes(".") && !network.includes(":");
  if (isV4) {
    const ipInt = ipv4ToInt(ip);
    const netInt = ipv4ToInt(network);
    if (ipInt === null || netInt === null) return false;
    const bits = prefix ?? 32;
    if (bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (netInt & mask);
  }

  const ipBig = ipv6ToBigInt(ip);
  const netBig = ipv6ToBigInt(network);
  if (ipBig === null || netBig === null) return false;
  const bits = BigInt(prefix ?? 128);
  if (bits < 0n || bits > 128n) return false;
  if (bits === 0n) return true;
  const mask = ((1n << bits) - 1n) << (128n - bits);
  return (ipBig & mask) === (netBig & mask);
}
