import { describe, expect, it } from "vitest";

import {
  extractArtwork,
  parseId3,
  parseStreamTitle,
  sanitizeTitle,
} from "./radioIcy";

describe("sanitizeTitle", () => {
  it.each([
    ["Artist - Song\u0000\u0000", "Artist - Song"],
    ["", ""],
    ["Tom &amp; Jerry &#39;n&#x27; &quot;x&quot;", "Tom & Jerry 'n' \"x\""],
    ["&lt;3 &apos;a&apos; &#65; &gt;", "<3 'a' A >"],
    ["Song*Title*Artist*2020*abc-123", "Artist - Title"],
    ["Song*Title**2020", "Title"],
    ["Music**Artist*", "Artist"],
    ["Song***", ""],
    ["Spot*Buy*Now*", ""],
    ["Ad*Buy*Now*", ""],
    ["Promo*Buy*Now*", ""],
    [
      'Fun. - text="We Are Young" song_spot="M" MediaBaseId="1827386"',
      "Fun. - We Are Young",
    ],
    ['text="Only the song" song_spot="M"', "Only the song"],
    ["title=Song;artist=Band;", "Band - Song"],
    ["title=Song;", "Song"],
    ["artist=Band", "Band"],
    ["A – B — C − D", "A - B - C - D"],
    ["  A   -\t\u0007 B ", "A - B"],
    ["Advertisement", ""],
    ["Commercial Break", ""],
    ["commercial", ""],
    ["Ad Break", ""],
    ["ADS", ""],
    ["Intermission", ""],
    ["Station ID", ""],
    ["Unknown", ""],
    ["No Program", ""],
  ])("cleans %j", (raw, clean) => {
    expect(sanitizeTitle(raw)).toBe(clean);
  });

  it("cuts at 256 characters", () => {
    expect(sanitizeTitle("a".repeat(300))).toHaveLength(256);
  });
});

describe("extractArtwork and parseStreamTitle", () => {
  const raw =
    'Fun. - text="We Are Young" AMGARTWORKURL="http://image.example/a.jpg"';
  it("reads iHeart's artwork", () => {
    expect(extractArtwork(raw)).toBe("http://image.example/a.jpg");
    expect(extractArtwork("Artist - Song")).toBe("");
    expect(extractArtwork(null)).toBe("");
    expect(parseStreamTitle(raw)).toEqual({
      title: "Fun. - We Are Young",
      artwork: "http://image.example/a.jpg",
    });
  });
});

function frame(id: string, encoding: number, text: number[]): number[] {
  const size = text.length + 1;
  return [
    ...new TextEncoder().encode(id),
    0,
    0,
    0,
    size,
    0,
    0,
    encoding,
    ...text,
  ];
}

function id3(...frames: number[][]): Uint8Array {
  const body = frames.flat();
  return new Uint8Array([
    0x49,
    0x44,
    0x33,
    4,
    0,
    0,
    0,
    0,
    body.length >> 7,
    body.length & 0x7f,
    ...body,
  ]);
}

describe("parseId3", () => {
  const utf8 = (text: string) => [...new TextEncoder().encode(text)];
  const utf16 = (text: string) => [
    0xff,
    0xfe,
    ...Array.from(text).flatMap((char) => [char.charCodeAt(0), 0]),
  ];

  it("joins artist and title in the encodings ID3 has", () => {
    expect(
      parseId3(
        id3(
          frame("TIT2", 3, utf8("Héllo\u0000")),
          frame("TPE1", 0, [0x42, 0xe9]),
        ),
      ),
    ).toBe("Bé - Héllo");
    expect(parseId3(id3(frame("TIT2", 1, utf16("Wide"))))).toBe("Wide");
  });

  it("takes whichever of the two is there", () => {
    expect(parseId3(id3(frame("TPE1", 3, utf8("Band"))))).toBe("Band");
    expect(parseId3(id3(frame("TXXX", 3, utf8("x"))))).toBe("");
  });

  it("answers nothing for something else", () => {
    expect(parseId3(new Uint8Array(20))).toBe("");
    expect(parseId3(new Uint8Array([0x49, 0x44, 0x33]))).toBe("");
    expect(parseId3(undefined)).toBe("");
  });
});
