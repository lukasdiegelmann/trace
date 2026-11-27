const HOUR_MS = 60 * 60 * 1000;

/**
 * Whether a look for a new version is due: `updateCheckInterval` hours have
 * passed since the last one. 0 means only by hand.
 */
export function isUpdateCheckDue(
  hours: unknown,
  lastCheckedAt: number,
  now: number,
): boolean {
  const interval = Number(hours) || 0;
  return interval > 0 && now - lastCheckedAt >= interval * HOUR_MS;
}
