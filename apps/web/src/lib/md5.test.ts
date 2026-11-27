import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { md5 } from "./md5";

describe("md5", () => {
  it.each([
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["a", "0cc175b9c0f1b6a831c399e269772661"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
    ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
  ])("gives RFC 1321's digest of %j", (text, digest) => {
    expect(md5(text)).toBe(digest);
  });

  it("agrees with Node across the block boundaries and for UTF-8", () => {
    const texts = [
      ...Array.from({ length: 140 }, (_, i) => "x".repeat(i)),
      "pässwörd 🎵",
    ];
    for (const text of texts) {
      expect(md5(text)).toBe(createHash("md5").update(text).digest("hex"));
    }
  });
});
