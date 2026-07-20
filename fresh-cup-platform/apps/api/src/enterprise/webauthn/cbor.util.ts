/**
 * A minimal CBOR (RFC 8949) decoder covering only the major types
 * WebAuthn's attestationObject/COSE_Key structures actually use:
 * unsigned/negative integers, byte strings, text strings, arrays, maps,
 * and the `true`/`false`/`null` simple values. No floats, no tags, no
 * indefinite-length items — those never appear in a WebAuthn payload, so
 * they're deliberately unsupported rather than silently mishandled.
 */
export type CborValue =
  number | Buffer | string | boolean | null | CborValue[] | Map<CborValue, CborValue>;

export interface CborDecodeResult {
  value: CborValue;
  offset: number;
}

function readLength(
  buffer: Buffer,
  offset: number,
  additionalInfo: number,
): { length: number; offset: number } {
  if (additionalInfo < 24) {
    return { length: additionalInfo, offset };
  }
  if (additionalInfo === 24) {
    return { length: buffer.readUInt8(offset), offset: offset + 1 };
  }
  if (additionalInfo === 25) {
    return { length: buffer.readUInt16BE(offset), offset: offset + 2 };
  }
  if (additionalInfo === 26) {
    return { length: buffer.readUInt32BE(offset), offset: offset + 4 };
  }
  if (additionalInfo === 27) {
    return { length: Number(buffer.readBigUInt64BE(offset)), offset: offset + 8 };
  }
  throw new Error(`Unsupported CBOR length encoding (additionalInfo=${additionalInfo})`);
}

export function decodeCbor(buffer: Buffer, startOffset = 0): CborDecodeResult {
  const initialByte = buffer.readUInt8(startOffset);
  const majorType = initialByte >> 5;
  const additionalInfo = initialByte & 0x1f;
  const offset = startOffset + 1;

  switch (majorType) {
    case 0: {
      const { length, offset: end } = readLength(buffer, offset, additionalInfo);
      return { value: length, offset: end };
    }
    case 1: {
      const { length, offset: end } = readLength(buffer, offset, additionalInfo);
      return { value: -1 - length, offset: end };
    }
    case 2: {
      const { length, offset: lenEnd } = readLength(buffer, offset, additionalInfo);
      return { value: buffer.subarray(lenEnd, lenEnd + length), offset: lenEnd + length };
    }
    case 3: {
      const { length, offset: lenEnd } = readLength(buffer, offset, additionalInfo);
      return {
        value: buffer.toString("utf8", lenEnd, lenEnd + length),
        offset: lenEnd + length,
      };
    }
    case 4: {
      const { length, offset: lenEnd } = readLength(buffer, offset, additionalInfo);
      const arr: CborValue[] = [];
      let cursor = lenEnd;
      for (let i = 0; i < length; i++) {
        const item = decodeCbor(buffer, cursor);
        arr.push(item.value);
        cursor = item.offset;
      }
      return { value: arr, offset: cursor };
    }
    case 5: {
      const { length, offset: lenEnd } = readLength(buffer, offset, additionalInfo);
      const map = new Map<CborValue, CborValue>();
      let cursor = lenEnd;
      for (let i = 0; i < length; i++) {
        const key = decodeCbor(buffer, cursor);
        const val = decodeCbor(buffer, key.offset);
        map.set(key.value, val.value);
        cursor = val.offset;
      }
      return { value: map, offset: cursor };
    }
    case 7: {
      if (additionalInfo === 20) return { value: false, offset };
      if (additionalInfo === 21) return { value: true, offset };
      if (additionalInfo === 22) return { value: null, offset };
      throw new Error(`Unsupported CBOR simple value (additionalInfo=${additionalInfo})`);
    }
    default:
      throw new Error(`Unsupported CBOR major type: ${majorType}`);
  }
}
