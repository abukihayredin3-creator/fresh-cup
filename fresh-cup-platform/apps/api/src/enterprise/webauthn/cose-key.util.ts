import { createPublicKey, type JsonWebKey, type KeyObject } from "node:crypto";
import { decodeCbor, type CborValue } from "./cbor.util";

export interface ParsedCoseKey {
  kty: number;
  alg: number;
  publicKey: KeyObject;
}

/**
 * The fixed DER SPKI prefix for an uncompressed NIST P-256 public key
 * (RFC 5480: id-ecPublicKey + prime256v1 OID, then a BIT STRING wrapping
 * the raw `0x04 || x || y` point). This is a deterministic structural
 * encoding, not a cryptographic choice — every P-256 SPKI key in the
 * world shares this exact prefix.
 */
const P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");

/**
 * Parses a COSE_Key (CBOR map, RFC 9053) into a Node `KeyObject` usable
 * with `crypto.verify()`. Supports EC2/P-256 (COSE alg -7, ES256 — the
 * WebAuthn default) by DER-wrapping the raw point, and RSA (COSE alg
 * -257, RS256) by handing Node's JWK importer the modulus/exponent
 * directly. Any other key type is rejected rather than guessed at.
 */
export function parseCoseKey(coseKeyBytes: Buffer): ParsedCoseKey {
  const { value } = decodeCbor(coseKeyBytes);
  const map = value as Map<number, CborValue>;
  const kty = map.get(1) as number;
  const alg = map.get(3) as number;

  if (kty === 2) {
    const crv = map.get(-1) as number;
    if (crv !== 1) {
      throw new Error(`Unsupported COSE EC curve: ${crv} — only P-256 (crv=1) is supported`);
    }
    const x = map.get(-2) as Buffer;
    const y = map.get(-3) as Buffer;
    const point = Buffer.concat([Buffer.from([0x04]), x, y]);
    const der = Buffer.concat([P256_SPKI_PREFIX, point]);
    const publicKey = createPublicKey({ key: der, format: "der", type: "spki" });
    return { kty, alg, publicKey };
  }

  if (kty === 3) {
    const n = map.get(-1) as Buffer;
    const e = map.get(-2) as Buffer;
    const jwk = { kty: "RSA", n: n.toString("base64url"), e: e.toString("base64url") };
    const publicKey = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
    return { kty, alg, publicKey };
  }

  throw new Error(`Unsupported COSE key type (kty=${kty})`);
}
