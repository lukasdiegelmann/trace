import { readGender, type Gender } from "./body";

export interface ProfileDraft {
  full_name: string;
  nickname: string;
  email: string;
  birthday: string;
  gender: Gender | "";
}

type Profile = Partial<Record<string, unknown>> | null | undefined;

function text(user: Profile, name: string): string {
  const value = user?.[name];
  return typeof value === "string" ? value : "";
}

/**
 * The form's start: each app keeps its own profile, and saving writes all of
 * them, so a field one app has filled must not start empty. The first
 * profile that has a value gives it.
 */
export function mergedProfile(users: readonly Profile[]): ProfileDraft {
  const first = (read: (user: Profile) => string) =>
    users.map(read).find(Boolean) ?? "";
  return {
    full_name: first((user) => text(user, "full_name")),
    nickname: first((user) => text(user, "nickname")),
    email: first((user) => text(user, "email")),
    birthday: first((user) => text(user, "birthday")),
    gender: first((user) => readGender(user?.gender)) as Gender | "",
  };
}
