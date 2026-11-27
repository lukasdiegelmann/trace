/** Small rules of the admin screens */

/** "expires in 30 days" as the servers store it: UTC "YYYY-MM-DD HH:MM:SS" */
export function tokenExpiry(
  days: number | null,
  now: number = Date.now(),
): string | null {
  if (days === null || !(days > 0)) return null;
  return new Date(now + days * 86_400_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/** The scope a new token starts with; each app knows different ones */
export function defaultScopes(known: readonly string[]): string[] {
  const preferred = ["read:foods", "read:recipes"].find((scope) =>
    known.includes(scope),
  );
  return preferred ? [preferred] : [];
}

export const SESSION_HOURS = [0, 8, 24, 168, 720, 2160, 8760] as const;

/** What `GET /app-config` shows instead of a stored secret */
export const SECRET_MASK = "••••••••";

export const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
] as const;

export type SmtpKey = (typeof SMTP_KEYS)[number];
export type SmtpForm = Record<SmtpKey, string>;

/**
 * The writes of a "Save": every field, except a password that is empty or
 * still the mask. (LiftTrace's old UI sent the empty one and erased it.)
 */
export function smtpWrites(form: SmtpForm): { key: SmtpKey; value: string }[] {
  return SMTP_KEYS.filter(
    (key) =>
      key !== "smtp_pass" ||
      (form.smtp_pass !== "" && form.smtp_pass !== SECRET_MASK),
  ).map((key) => ({ key, value: form[key] }));
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
