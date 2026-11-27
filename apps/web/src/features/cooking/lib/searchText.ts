/**
 * One definition of "does this text match what the user typed", ported
 * from cooktrace/src/lib/search-text.js (kept byte-identical across the
 * Trace apps there). Both sides are lowercased and stripped of accents, so
 * "oregano" finds "Orégano"; text without accents is unchanged.
 */

/** Letters that carry no combining mark to strip, so NFD cannot fold them */
const SPECIALS: readonly (readonly [RegExp, string])[] = [
  [/ß/g, "ss"],
  [/æ/g, "ae"],
  [/œ/g, "oe"],
  [/ø/g, "o"],
  [/ł/g, "l"],
  [/đ/g, "d"],
  [/ð/g, "d"],
  [/þ/g, "th"],
];

const COMBINING_MARKS = /[̀-ͯ]/g;

function asText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

/** Lowercase and drop accents, nothing else (DuckDB's `strip_accents`) */
export function stripAccents(value: unknown): string {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "");
}

/** `stripAccents` plus the letters NFD cannot reach */
export function foldText(value: unknown): string {
  let out = asText(value).toLowerCase();
  for (const [pattern, replacement] of SPECIALS) {
    out = out.replace(pattern, replacement);
  }
  return out.normalize("NFD").replace(COMBINING_MARKS, "");
}

/** True when `haystack` contains `query`, accents aside; empty matches all */
export function includesFolded(haystack: unknown, query: unknown): boolean {
  return foldText(haystack).includes(foldText(query).trim());
}

/** Every whitespace-separated token of the query appears in the haystack */
export function coversFolded(haystack: unknown, query: unknown): boolean {
  const hay = foldText(haystack);
  const tokens = foldText(query).trim().split(/\s+/).filter(Boolean);
  return tokens.every((token) => hay.includes(token));
}
