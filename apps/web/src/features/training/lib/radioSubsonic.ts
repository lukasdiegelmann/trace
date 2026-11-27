/** Subsonic's request parameters, after backends/lifttrace/src/lib/subsonic.js */
import { md5 } from "@/lib/md5";

const APP_NAME = "LiftTrace";
const API_VERSION = "1.16.1";
const SALT_LENGTH = 8;

export interface SubsonicCredentials {
  user: string;
  password: string;
}

/** 8 random base-36 characters */
export function randomSalt(random: () => number = Math.random): string {
  return Array.from({ length: SALT_LENGTH }, () =>
    Math.floor(random() * 36).toString(36),
  ).join("");
}

/** `u`, `t = md5(password + salt)`, `s`, the API version and the call's own */
export function buildSubsonicParams(
  credentials: SubsonicCredentials,
  extra: Record<string, string> = {},
  salt: string = randomSalt(),
): URLSearchParams {
  return new URLSearchParams({
    u: credentials.user,
    t: md5(credentials.password + salt),
    s: salt,
    v: API_VERSION,
    c: APP_NAME,
    f: "json",
    ...extra,
  });
}
