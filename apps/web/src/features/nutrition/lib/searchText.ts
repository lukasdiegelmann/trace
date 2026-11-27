/**
 * Whether text matches what the user typed, accents aside, ported from
 * nutritrace/src/lib/search-text.js ("Café" is found by "cafe").
 */

/** Letters without a combining mark to strip, so NFD can't fold them */
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

export function foldText(value: string | null | undefined): string {
  let out = (value ?? "").toLowerCase();
  for (const [pattern, to] of SPECIALS) out = out.replace(pattern, to);
  return out.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function includesFolded(
  haystack: string | null | undefined,
  query: string,
): boolean {
  return foldText(haystack).includes(foldText(query).trim());
}
