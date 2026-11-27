/**
 * Progress photo logic, after ProgressPhotosTimeline.svelte,
 * PhotoScrubber.svelte and lib/progress-photo-upload.js.
 */

export interface ProgressPhoto {
  id: number;
  date: string;
  url: string;
}

/**
 * Where a photo's picture comes from. Rows may point at an image hosted
 * elsewhere (added over the API); everything else is only served to its
 * owner, never from the open uploads folder. The browser sends the session
 * cookie with an <img>, and the server answers `max-age=0`.
 */
export function photoSrc(photo: ProgressPhoto): string {
  return /^(https?:|data:|blob:)/i.test(photo.url)
    ? photo.url
    : `/lt/api/body-stats/photos/${photo.id}/file`;
}

export function isHeic(file: { name?: string; type?: string }): boolean {
  return (
    /\.hei[cf]$/i.test(file.name ?? "") ||
    /^image\/hei[cf]/i.test(file.type ?? "")
  );
}

/** Month buckets in the order the photos come (newest first) */
export function groupByMonth<T extends ProgressPhoto>(
  photos: T[],
): { month: string; photos: T[] }[] {
  const groups: { month: string; photos: T[] }[] = [];
  for (const photo of photos) {
    const month = photo.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.photos.push(photo);
    else groups.push({ month, photos: [photo] });
  }
  return groups;
}

export function oldestFirst<T extends ProgressPhoto>(photos: T[]): T[] {
  return [...photos].sort((a, b) => a.date.localeCompare(b.date));
}

/** The older of two photos is always "before" */
export function comparePair<T extends ProgressPhoto>(
  a: T,
  b: T,
): { before: T; after: T } {
  return a.date.localeCompare(b.date) <= 0
    ? { before: a, after: b }
    : { before: b, after: a };
}

function dayTime(date: string): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Each photo's place on a real date axis, 0–100, so a gap in the record
 * shows. With a single date they spread evenly.
 */
export function axisPositions(ordered: ProgressPhoto[]): number[] {
  const times = ordered.map((p) => dayTime(p.date));
  const first = times[0] ?? 0;
  const last = times.at(-1) ?? 0;
  if (!(last > first)) {
    return ordered.map((_, i) =>
      ordered.length === 1 ? 50 : (i / (ordered.length - 1)) * 100,
    );
  }
  return times.map((time) => ((time - first) / (last - first)) * 100);
}

export function nearestIndex(positions: number[], percent: number): number {
  let best = 0;
  positions.forEach((position, index) => {
    if (
      Math.abs(position - percent) < Math.abs((positions[best] ?? 0) - percent)
    ) {
      best = index;
    }
  });
  return best;
}

/** Days since the first photo; null on the first day */
export function daysSinceFirst(
  ordered: ProgressPhoto[],
  index: number,
): number | null {
  const first = ordered.at(0);
  const current = ordered.at(index);
  if (!first || !current) return null;
  const days = Math.round(
    (dayTime(current.date) - dayTime(first.date)) / 86400000,
  );
  return days > 0 ? days : null;
}

/**
 * The change since the earliest photo that has a weight, to one decimal;
 * null for that photo, without a weight, or under 0.05.
 */
export function weightDelta(
  ordered: ProgressPhoto[],
  index: number,
  weightOf: (date: string) => number | null,
): { delta: number; since: string } | null {
  const current = ordered.at(index);
  const baseline = ordered.find((p) => weightOf(p.date) !== null);
  if (!current || !baseline || current.date === baseline.date) return null;
  const weight = weightOf(current.date);
  const first = weightOf(baseline.date);
  if (weight === null || first === null) return null;
  const difference = weight - first;
  if (Math.abs(difference) < 0.05) return null;
  return {
    delta: Math.round(difference * 10) / 10,
    since: baseline.date,
  };
}

/** A weight from a body stats blob; null when empty or not a number */
export function weightOfStats(
  stats: Record<string, unknown> | null | undefined,
): number | null {
  const raw = stats?.weight;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const weight = parseFloat(String(raw));
  return Number.isFinite(weight) ? weight : null;
}
