import { useTranslation } from "react-i18next";

import { daysUntil, expiryStatus } from "../lib/expiry";

/** "Expired", "Expires today", "Expires in 3 days"; null when not soon */
export function useExpiryLabel() {
  const { t } = useTranslation("cooking");
  return (date: string): string | null => {
    const status = expiryStatus(date);
    if (status === "past") return t("pantry.expiry.expired");
    if (status !== "warn") return null;
    const days = daysUntil(date) ?? 0;
    if (days === 0) return t("pantry.expiry.today");
    if (days === 1) return t("pantry.expiry.tomorrow");
    return t("pantry.expiry.inDays", { count: days });
  };
}
