/**
 * One definition of "does this text match what the user typed", after
 * backends/lifttrace/src/lib/search-text.js (byte-identical across the
 * Trace apps and with the server's copy): lowercase, accents and the
 * letters NFD cannot reach folded away.
 */

/** Letters that carry no combining mark to strip, so NFD cannot fold them */
const SPECIALS: [RegExp, string][] = [
  [/ß/g, "ss"],
  [/æ/g, "ae"],
  [/œ/g, "oe"],
  [/ø/g, "o"],
  [/ł/g, "l"],
  [/đ/g, "d"],
  [/ð/g, "d"],
  [/þ/g, "th"],
];

/** Text of a primitive; objects and nullish become "" */
export function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return "";
}

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase and drop accents, nothing else (what SQL `strip_accents` does) */
export function stripAccents(text: unknown): string {
  return toText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "");
}

/** `stripAccents` plus the letters NFD cannot reach */
export function foldText(text: unknown): string {
  let out = toText(text).toLowerCase();
  for (const [pattern, replacement] of SPECIALS) {
    out = out.replace(pattern, replacement);
  }
  return out.normalize("NFD").replace(COMBINING_MARKS, "");
}

/** `haystack` contains `query`, accents aside; an empty query matches */
export function includesFolded(haystack: unknown, query: unknown): boolean {
  return foldText(haystack).includes(foldText(query).trim());
}

/** Every whitespace-separated token of the query appears, in any order */
export function coversFolded(haystack: unknown, query: unknown): boolean {
  const hay = foldText(haystack);
  const tokens = foldText(query).trim().split(/\s+/).filter(Boolean);
  return tokens.every((token) => hay.includes(token));
}
