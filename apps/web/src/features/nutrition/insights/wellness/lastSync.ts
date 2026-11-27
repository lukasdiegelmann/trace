/**
 * When the wearables last synced from this browser, under the old UI's
 * localStorage keys, so both UIs on the origin agree.
 */
import { AUTO_SYNC_COOLDOWN_MS } from "../../lib/insights/wellness";

const LAST_SYNC_KEY = "nt:wellnessLastSync";
const cooldownKey = (date: string) => `wl_wellness_lastSync_${date}`;

export interface LastSync {
  at: number;
  provider: string;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode: forgotten on reload.
  }
}

export function readLastSync(): LastSync | null {
  const stored = read(LAST_SYNC_KEY) ?? "";
  const [at, ...rest] = stored.split("|");
  return Number(at) ? { at: Number(at), provider: rest.join("|") } : null;
}

export function writeLastSync(provider: string): LastSync {
  const next = { at: Date.now(), provider };
  write(LAST_SYNC_KEY, `${next.at}|${provider}`);
  return next;
}

/** Whether `date` may auto-sync again (15 minutes after the last time) */
export function isAutoSyncDue(date: string, now: number = Date.now()): boolean {
  const last = Number(read(cooldownKey(date)));
  return !last || now - last > AUTO_SYNC_COOLDOWN_MS;
}

export function startCooldown(date: string): void {
  write(cooldownKey(date), String(Date.now()));
}
