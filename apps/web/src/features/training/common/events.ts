/**
 * Fired on `window` after body stats were saved, so every screen that shows
 * them loads again: `dispatchEvent(new CustomEvent(BODY_STATS_SAVED, { detail: { date } }))`
 */
export const BODY_STATS_SAVED = "trace:lt-body-stats-saved";
