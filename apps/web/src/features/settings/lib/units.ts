/**
 * The three apps store some units differently; one control in Trace writes
 * each backend in its own form.
 */
import type { ValueMap } from "../common/binding";

/** NutriTrace: kg | lb | st; LiftTrace: kg | lbs (no stone) */
export const liftWeightUnit: ValueMap<string> = {
  fromBackend: (raw) => (raw === "kg" ? "kg" : "lb"),
  toBackend: (value) => (value === "kg" ? "kg" : "lbs"),
};

/** LiftTrace has no "natural" date format (D MMM YYYY); day first is closest */
export const liftDateFormat: ValueMap<string> = {
  fromBackend: (raw) => (typeof raw === "string" ? raw : "US"),
  toBackend: (value) => (value === "natural" ? "EU" : value),
};

/** The device's IANA time zone, which the servers' schedulers need */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}
