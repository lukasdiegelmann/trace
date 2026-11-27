import i18next from "i18next";

import { AiError } from "./types";

/** What to show for a failed request: ours translated, the provider's as is */
export function aiErrorText(caught: unknown): string {
  if (caught instanceof AiError) {
    return i18next.t(`assistant:errors.${caught.problem}`, {
      host: caught.host ?? "",
      origin: window.location.origin,
    });
  }
  return caught instanceof Error ? caught.message : String(caught);
}
