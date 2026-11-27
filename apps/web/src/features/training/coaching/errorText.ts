import type { TFunction } from "i18next";

import { ApiError } from "@/api";

/** Codes the backend sends with its English refusals */
const CODES = {
  leave_first: "coaching.errors.leaveFirst",
  status_changed: "coaching.errors.statusChanged",
  already_client: "coaching.errors.alreadyClient",
  already_asked: "coaching.errors.alreadyAsked",
} as const;

function codeOf(error: ApiError): keyof typeof CODES | null {
  const body = error.body;
  if (typeof body !== "object" || body === null || !("code" in body)) {
    return null;
  }
  const code = body.code;
  return typeof code === "string" && code in CODES
    ? (code as keyof typeof CODES)
    : null;
}

/** The message for a failed coaching call: no connection says so plainly */
export function coachingErrorText(
  error: unknown,
  t: TFunction<"training">,
  name = "",
): string {
  if (!(error instanceof ApiError) || error.status === 503) {
    return t("coaching.needsConnection");
  }
  const code = codeOf(error);
  if (code) return t(CODES[code], { name });
  return error.message || t("coaching.somethingFailed");
}
