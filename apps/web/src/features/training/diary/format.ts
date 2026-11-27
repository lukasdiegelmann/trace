/** Dates and relative times of the diary, localised with `Intl` */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  dayOffset,
  localDateStr,
  parseLocalDate,
  relativeTime,
} from "../lib/dates";
import type { Store } from "../lib/store";

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** The time now, refreshed every `ms` while `isActive` */
export function useNow(ms: number, isActive: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      setNow(Date.now());
    };
    // At once, so a clock that was idle doesn't show a stale time
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [ms, isActive]);
  return now;
}

/** Today's date, following midnight and a return to the tab */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateStr());
  useEffect(() => {
    const check = () => {
      setToday(localDateStr());
    };
    const timer = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return today;
}

/** The date in the user's `dateFormat` setting (US, EU, ISO) */
export function numericDate(date: string, format: string): string {
  if (format === "ISO") return date;
  return parseLocalDate(date).toLocaleDateString(
    format === "EU" ? "en-GB" : "en-US",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

export function useDiaryFormats() {
  const { t, i18n } = useTranslation("training");
  const language = i18n.language;

  const shortDate = (date: string) =>
    parseLocalDate(date).toLocaleDateString(language, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  /** Today, Yesterday, Tomorrow, or "Mon, Nov 23" */
  const dayTitle = (date: string, today: string) => {
    const offset = dayOffset(date, today);
    if (offset === 0) return t("diary.nav.today");
    if (offset === -1) return t("diary.nav.yesterday");
    if (offset === 1) return t("diary.nav.tomorrow");
    return shortDate(date);
  };

  const ago = (time: string | null | undefined) => {
    const relative = relativeTime(time);
    if (!relative) return "";
    if (relative.unit === "now") return t("diary.time.now");
    if (relative.unit === "date") {
      return new Date(relative.value).toLocaleDateString(language);
    }
    return new Intl.RelativeTimeFormat(language, {
      numeric: "always",
      style: "short",
    }).format(-relative.value, relative.unit);
  };

  /** How long ago a past day was: today, yesterday, 3 days ago… */
  const daysAgo = (date: string, today: string) => {
    const days = Math.max(0, -dayOffset(date, today));
    const format = new Intl.RelativeTimeFormat(language, {
      numeric: "auto",
      style: "short",
    });
    if (days < 7) return format.format(-days, "day");
    if (days < 30) return format.format(-Math.round(days / 7), "week");
    return format.format(-Math.round(days / 30), "month");
  };

  const number = (value: number, digits = 1) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: digits,
    }).format(value);

  return { shortDate, dayTitle, ago, daysAgo, number, language };
}
