/**
 * Expiry dates of pantry rows (cooktrace Pantry.svelte and
 * PantryItemSheet.svelte, Issue #9 there): 14 days warn, past is expired.
 */
import { isoDate, toDate } from "./relativeTime";

export const EXPIRY_WARN_DAYS = 14;

export type ExpiryStatus = "none" | "past" | "warn" | "ok";

/** Whole days from today to the date (negative: past), or null */
export function daysUntil(
  date: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!date) return null;
  const then = toDate(date.slice(0, 10));
  if (Number.isNaN(then.getTime())) return null;
  const today = toDate(isoDate(now));
  return Math.round((then.getTime() - today.getTime()) / 86_400_000);
}

export function expiryStatus(
  date: string | null | undefined,
  now: Date = new Date(),
): ExpiryStatus {
  const days = daysUntil(date, now);
  if (days === null) return "none";
  if (days < 0) return "past";
  return days <= EXPIRY_WARN_DAYS ? "warn" : "ok";
}

export function isExpiring(
  date: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const status = expiryStatus(date, now);
  return status === "past" || status === "warn";
}

export interface Dated {
  expires_on?: string | null;
}

function earliest<T extends Dated>(
  rows: readonly T[],
  status: ExpiryStatus,
  now: Date,
): T | null {
  let found: T | null = null;
  for (const row of rows) {
    if (!row.expires_on || expiryStatus(row.expires_on, now) !== status) {
      continue;
    }
    if (!found?.expires_on || row.expires_on < found.expires_on) found = row;
  }
  return found;
}

/**
 * The date a list card warns about: a flat item's or variant's own; a
 * generic's worst child (past before warn). Null: nothing to show.
 */
export function effectiveExpiry(
  item: Dated,
  variants: readonly Dated[],
  now: Date = new Date(),
): string | null {
  if (variants.length === 0) return item.expires_on || null;
  const worst =
    earliest(variants, "past", now) ?? earliest(variants, "warn", now);
  return worst?.expires_on ?? null;
}

/** A generic's soonest variant: past, then warn, then any dated one */
export function earliestVariantExpiry<T extends Dated>(
  variants: readonly T[],
  now: Date = new Date(),
): { variant: T; status: ExpiryStatus } | null {
  for (const status of ["past", "warn", "ok"] as const) {
    const variant = earliest(variants, status, now);
    if (variant) return { variant, status };
  }
  return null;
}
