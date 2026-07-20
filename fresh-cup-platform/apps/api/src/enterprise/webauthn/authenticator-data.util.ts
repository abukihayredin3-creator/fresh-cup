export interface ParsedAuthenticatorData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  credentialId?: Buffer;
  credentialPublicKey?: Buffer;
}

const USER_PRESENT_FLAG = 0x01;
const ATTESTED_CREDENTIAL_DATA_FLAG = 0x40;

/** Parses the fixed-layout `authenticatorData` bytes (WebAuthn spec §6.1). */
export function parseAuthenticatorData(buffer: Buffer): ParsedAuthenticatorData {
  const rpIdHash = buffer.subarray(0, 32);
  const flags = buffer.readUInt8(32);
  const signCount = buffer.readUInt32BE(33);

  if (!(flags & ATTESTED_CREDENTIAL_DATA_FLAG)) {
    return { rpIdHash, flags, signCount };
  }

  let offset = 37 + 16; // skip fixed header (37) + aaguid (16)
  const credentialIdLength = buffer.readUInt16BE(offset);
  offset += 2;
  const credentialId = buffer.subarray(offset, offset + credentialIdLength);
  offset += credentialIdLength;
  // The COSE_Key CBOR map is next; any trailing extension bytes are
  // ignored — decodeCbor() only consumes as many bytes as the map needs.
  const credentialPublicKey = buffer.subarray(offset);

  return { rpIdHash, flags, signCount, credentialId, credentialPublicKey };
}

export function isUserPresent(flags: number): boolean {
  return (flags & USER_PRESENT_FLAG) !== 0;
}
