/**
 * Now-playing texts of radio stations: ICY StreamTitle (after
 * backends/lifttrace/src/lib/radio-icy.js) and the ID3 tags of HLS segments
 * (after `_parseId3` in stores/player.js).
 */

const AD_MARKERS = new Set([
  "advertisement",
  "commercial break",
  "commercial",
  "ad break",
  "ads",
  "intermission",
  "station id",
  "unknown",
  "no program",
]);

const MAX_TITLE = 256;

/** iHeart's `amgArtworkURL="..."`: the song's cover; "" for other stations */
export function extractArtwork(raw: string | null | undefined): string {
  if (!raw) return "";
  const match = /amgArtworkURL\s*=\s*"([^"]+)"/i.exec(raw);
  return match?.[1]?.trim() ?? "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function joinArtistTitle(artist: string, title: string): string {
  if (artist && title) return `${artist} - ${title}`;
  return title || artist;
}

/** A StreamTitle as a readable "Artist - Song"; "" for ads and nothing */
export function sanitizeTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  // eslint-disable-next-line no-control-regex -- NUL padding of ICY blocks
  let text = decodeEntities(raw.replace(/\u0000+/g, "").trim());

  // RDS Italia: `Song*<title>*<artist>*<year>*<uuid>`, `Spot*...` for ads
  const star =
    /^(Song|Spot|Track|Music|News|Promo|Ad)\s*\*\s*([^*]*?)\s*\*\s*([^*]*?)\s*(?:\*|$)/i.exec(
      text,
    );
  // iHeart: the artist before `text=`, the song in its quoted value
  const iheart = /^(.*?)\s*\btext\s*=\s*"([^"]+)"/i.exec(text);
  if (star) {
    const type = star[1].toLowerCase();
    if (type === "spot" || type === "ad" || type === "promo") return "";
    text = joinArtistTitle(star[3].trim(), star[2].trim());
  } else if (iheart) {
    const prefix = iheart[1].replace(/[\s\-‐-―]+$/, "").trim();
    text = joinArtistTitle(prefix, iheart[2].trim());
  } else if (/\b(title|artist)\s*=/i.test(text)) {
    // Shoutcast: `title=Song;artist=Band;`
    const field = (name: string) =>
      new RegExp(`\\b${name}\\s*=\\s*["']?([^"';\\r\\n]+?)["';]?(?:;|$)`, "i")
        .exec(text)?.[1]
        ?.trim() ?? "";
    text = joinArtistTitle(field("artist"), field("title")) || text;
  }

  text = text
    .replace(/[‐-―−]/g, "-")
    // eslint-disable-next-line no-control-regex -- control characters out
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (AD_MARKERS.has(text.toLowerCase())) return "";
  return text.slice(0, MAX_TITLE);
}

export interface StreamTitle {
  title: string;
  artwork: string;
}

export function parseStreamTitle(raw: string): StreamTitle {
  return { title: sanitizeTitle(raw), artwork: extractArtwork(raw) };
}

function decodeId3Text(encoding: number, data: Uint8Array): string {
  const label =
    encoding === 0
      ? "iso-8859-1"
      : encoding === 1 || encoding === 2
        ? "utf-16"
        : "utf-8";
  try {
    return (
      new TextDecoder(label)
        .decode(data)
        // eslint-disable-next-line no-control-regex -- the terminator
        .replace(/\u0000+$/g, "")
        .trim()
    );
  } catch {
    return "";
  }
}

/** TIT2 and TPE1 of an ID3v2 tag as "artist - title"; "" if it isn't one */
export function parseId3(bytes: Uint8Array | null | undefined): string {
  if (!bytes || bytes.length < 10) return "";
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return "";
  const byte = (at: number) => bytes[at] ?? 0;
  const size =
    ((byte(6) & 0x7f) << 21) |
    ((byte(7) & 0x7f) << 14) |
    ((byte(8) & 0x7f) << 7) |
    (byte(9) & 0x7f);
  const end = Math.min(10 + size, bytes.length);
  let position = 10;
  let title = "";
  let artist = "";
  while (position <= end - 10) {
    const id = String.fromCharCode(...bytes.subarray(position, position + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize =
      (byte(position + 4) << 24) |
      (byte(position + 5) << 16) |
      (byte(position + 6) << 8) |
      byte(position + 7);
    if (frameSize <= 0 || position + 10 + frameSize > end) break;
    if (id === "TIT2" || id === "TPE1") {
      const text = decodeId3Text(
        byte(position + 10),
        bytes.subarray(position + 11, position + 10 + frameSize),
      );
      if (id === "TIT2") title = text;
      else artist = text;
    }
    position += 10 + frameSize;
  }
  return joinArtistTitle(artist, title);
}
