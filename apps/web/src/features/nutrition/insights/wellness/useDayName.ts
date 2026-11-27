import { addDays, localDateStr, parseDay } from "../../lib/insights/dates";
import { useInsightsT } from "../useInsightsT";

/** "Today", "Yesterday" or the weekday, then the date in the user's format */
export function useDayName() {
  const { t, locale } = useInsightsT();
  return (date: string) => {
    const today = localDateStr();
    if (date === today) return t("common.today");
    if (date === addDays(today, -1)) return t("common.yesterday");
    return parseDay(date).toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };
}
