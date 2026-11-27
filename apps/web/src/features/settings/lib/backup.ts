/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
export interface BackupSchedule {
  schedule: "off" | "daily" | "weekly" | "monthly";
  time: string;
  retention: number;
  lastAutoRun?: string | null;
  lastAutoError?: string | null;
  envLocked?: boolean;
}

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

const INTERVAL_DAYS = { daily: 1, weekly: 7, monthly: 28 } as const;

/**
 * When the next automatic backup is due: today at the set time if that is
 * still ahead and the last run is an interval ago, else the first later day
 * for which both hold (SettingsBackup.svelte, _nextDueLabel).
 */
export function nextBackupAt(
  config: Pick<BackupSchedule, "schedule" | "time" | "lastAutoRun">,
  now: Date = new Date(),
): Date | null {
  if (config.schedule === "off") return null;
  const [hours = 0, minutes = 0] = config.time.split(":").map(Number);
  const interval = INTERVAL_DAYS[config.schedule];
  const last = config.lastAutoRun
    ? new Date(config.lastAutoRun).getTime()
    : null;
  const at = (offset: number) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hours,
      minutes,
    );
  for (let offset = 0; offset <= 62; offset++) {
    const next = at(offset);
    if (next.getTime() <= now.getTime()) continue;
    if (
      last === null ||
      (next.getTime() - last) / 86_400_000 >= interval - 0.5
    ) {
      return next;
    }
  }
  return null;
}

/** LiftTrace's "clear settings": these keys back to their defaults */
export const LIFT_RESET_VALUES = {
  appearance: "system",
  accentColor: "orange",
  weightUnit: "lbs",
  dateFormat: "US",
  timeFormat: "12h",
  weeklyWorkoutGoal: 3,
  navStyle: "bottom",
  sidebarPersistent: false,
  disableAnimations: false,
  bannerStyle: "off",
  startPage: "/",
  screenKeepAwake: true,
  goalCelebrations: true,
} as const;
