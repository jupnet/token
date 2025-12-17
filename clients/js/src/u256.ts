/** Convert a bigint to a 32-byte little-endian array (U256) */
export function u256ToLeBytes(value: bigint | number): Array<number> {
  const bytes = new Array(32).fill(0);
  let remaining = BigInt(value);
  for (let i = 0; i < 32 && remaining > 0n; i++) {
    bytes[i] = Number(remaining & 0xffn);
    remaining = remaining >> 8n;
  }
  return bytes;
}

/** Convert a 32-byte little-endian array to a bigint (U256) */
export function leBytesToU256(bytes: Array<number>): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}
