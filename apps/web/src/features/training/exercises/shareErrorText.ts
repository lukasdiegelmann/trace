import type { TFunction } from "i18next";

import type { ShareError } from "../lib/exerciseShare";

export function shareErrorText(
  t: TFunction<"training">,
  error: ShareError,
): string {
  return t(`exercises.import.errors.${error.code}`, { detail: error.detail });
}
