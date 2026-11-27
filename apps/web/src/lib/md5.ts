/**
 * MD5 (RFC 1321), only for Subsonic's token auth: `t = md5(password + salt)`.
 * Not for anything that needs a secure hash.
 */

const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

const SINES = Array.from(
  { length: 64 },
  (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0,
);

/** The digest of the UTF-8 bytes of `text`, as 32 hex characters */
export function md5(text: string): string {
  const bytes = new TextEncoder().encode(text);
  // 0x80, zeroes, then the length in bits as 64 bit little-endian
  const size = (((bytes.length + 8) >> 6) + 1) * 64;
  const view = new DataView(new ArrayBuffer(size));
  bytes.forEach((byte, i) => {
    view.setUint8(i, byte);
  });
  view.setUint8(bytes.length, 0x80);
  view.setUint32(size - 8, (bytes.length * 8) >>> 0, true);
  view.setUint32(size - 4, Math.floor(bytes.length / 2 ** 29), true);

  const hash = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let block = 0; block < size; block += 64) {
    let [a = 0, b = 0, c = 0, d = 0] = hash;
    for (let i = 0; i < 64; i++) {
      const round = i >> 4;
      let mix: number;
      let word: number;
      if (round === 0) {
        mix = (b & c) | (~b & d);
        word = i;
      } else if (round === 1) {
        mix = (d & b) | (~d & c);
        word = (5 * i + 1) % 16;
      } else if (round === 2) {
        mix = b ^ c ^ d;
        word = (3 * i + 5) % 16;
      } else {
        mix = c ^ (b | ~d);
        word = (7 * i) % 16;
      }
      const sum =
        (a + mix + (SINES[i] ?? 0) + view.getUint32(block + word * 4, true)) >>>
        0;
      const shift = SHIFTS[round * 4 + (i % 4)] ?? 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
    }
    [a, b, c, d].forEach((value, i) => {
      hash[i] = ((hash[i] ?? 0) + value) >>> 0;
    });
  }

  const out = new DataView(new ArrayBuffer(16));
  hash.forEach((value, i) => {
    out.setUint32(i * 4, value, true);
  });
  return Array.from(new Uint8Array(out.buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
