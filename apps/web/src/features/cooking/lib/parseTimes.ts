/**
 * Finds duration mentions in step text so they become timer buttons,
 * ported from cooktrace/src/lib/parseTimes.js. Ranges take the lower
 * bound; only 1 s to 24 h count.
 */
const NUMBER = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const HOURS = "(?:hours?|hrs?|h)\\b";
const MINUTES = "(?:minutes?|mins?|m)\\b";
const SECONDS = "(?:seconds?|secs?|s)\\b";
const RANGE_SEPARATOR = "\\s*(?:to|-|–)\\s*";

const range = (unit: string) =>
  `${NUMBER}${RANGE_SEPARATOR}${NUMBER}\\s*${unit}`;
const token = (unit: string) => `${NUMBER}\\s*${unit}`;

const PATTERN = [
  `${token(HOURS)}\\s+${token(MINUTES)}`,
  range(MINUTES),
  range(HOURS),
  range(SECONDS),
  token(HOURS),
  token(MINUTES),
  token(SECONDS),
].join("|");

function parseNumber(value: string): number {
  const text = value.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(text);
  if (mixed && Number(mixed[3]) > 0) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction && Number(fraction[2]) > 0) {
    return Number(fraction[1]) / Number(fraction[2]);
  }
  return Number.parseFloat(text);
}

function match(text: string, pattern: string): RegExpExecArray | null {
  return new RegExp(pattern, "i").exec(text);
}

function toSeconds(found: string): number {
  const text = found.toLowerCase();
  const combined = match(
    text,
    `(${NUMBER})\\s*${HOURS}\\s+(${NUMBER})\\s*${MINUTES}`,
  );
  if (combined) {
    return Math.round(
      parseNumber(combined[1]) * 3600 + parseNumber(combined[2]) * 60,
    );
  }
  for (const [unit, factor] of [
    [MINUTES, 60],
    [HOURS, 3600],
    [SECONDS, 1],
  ] as const) {
    const ranged = match(
      text,
      `(${NUMBER})${RANGE_SEPARATOR}(${NUMBER})\\s*${unit}`,
    );
    if (ranged) {
      return Math.round(
        Math.min(parseNumber(ranged[1]), parseNumber(ranged[2])) * factor,
      );
    }
  }
  let total = 0;
  for (const [unit, factor] of [
    [HOURS, 3600],
    [MINUTES, 60],
    [SECONDS, 1],
  ] as const) {
    const single = match(text, `(${NUMBER})\\s*${unit}`);
    if (single) total += parseNumber(single[1]) * factor;
  }
  return Math.round(total) || 0;
}

export interface TimeMatch {
  start: number;
  end: number;
  text: string;
  durationSec: number;
}

export function findTimes(text: string): TimeMatch[] {
  const found: TimeMatch[] = [];
  for (const result of text.matchAll(new RegExp(PATTERN, "gi"))) {
    const durationSec = toSeconds(result[0]);
    if (durationSec > 0 && durationSec <= 24 * 3600) {
      found.push({
        start: result.index,
        end: result.index + result[0].length,
        text: result[0],
        durationSec,
      });
    }
  }
  return found;
}

export type StepPart =
  | { type: "text"; value: string }
  | { type: "time"; value: string; durationSec: number };

export function splitWithTimes(text: string): StepPart[] {
  const matches = findTimes(text);
  if (matches.length === 0) return [{ type: "text", value: text }];
  const parts: StepPart[] = [];
  let cursor = 0;
  for (const found of matches) {
    if (found.start > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, found.start) });
    }
    parts.push({
      type: "time",
      value: found.text,
      durationSec: found.durationSec,
    });
    cursor = found.end;
  }
  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }
  return parts;
}
