/**
 * Cardio sessions of the diary: form validation, the payload sent to the
 * backend and the row texts, ported from LiftTrace
 * `components/diary/CardioCard.svelte`.
 */

export type DistanceUnit = "km" | "mi";

/** A row of `cardio_log` as the backend sends it */
export interface CardioSession {
  id: number;
  date: string;
  activity: string;
  duration_min: number;
  distance: number | null;
  distance_unit: string | null;
  avg_hr: number | null;
  notes: string | null;
  is_template?: number | boolean | null;
}

/** What POST /cardio and PUT /cardio/:id take */
export interface CardioPayload {
  date: string;
  activity: string;
  duration_min: number;
  distance: number | null;
  distance_unit: string;
  avg_hr: number | null;
  notes: string | null;
}

/** The form's fields, as typed */
export interface CardioForm {
  activity: string;
  duration: string;
  distance: string;
  hr: string;
  notes: string;
}

/**
 * What the browser knows about the number fields: a number input holding
 * text it can't parse reports an empty value, only `validity.badInput`
 * tells it from a blank field.
 */
export interface CardioFieldValidity {
  isDistanceBadInput?: boolean;
  isHrBadInput?: boolean;
}

export type CardioFormError =
  "activityRequired" | "durationInvalid" | "distanceInvalid" | "hrInvalid";

export const EMPTY_CARDIO_FORM: CardioForm = {
  activity: "",
  duration: "",
  distance: "",
  hr: "",
  notes: "",
};

/** Miles for a user who weighs in lbs, kilometres otherwise */
export function cardioDistanceUnit(weightUnit: string): DistanceUnit {
  return weightUnit === "lbs" ? "mi" : "km";
}

/** The form prefilled from a session, for editing it */
export function cardioFormFromSession(session: CardioSession): CardioForm {
  return {
    activity: session.activity || "",
    duration: String(session.duration_min),
    distance: session.distance != null ? String(session.distance) : "",
    hr: session.avg_hr != null ? String(session.avg_hr) : "",
    notes: session.notes || "",
  };
}

function isNotANumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && !Number.isFinite(Number(trimmed));
}

/** The first problem of the form, in the old UI's order, or null */
export function validateCardioForm(
  form: CardioForm,
  validity: CardioFieldValidity = {},
): CardioFormError | null {
  if (!form.activity.trim()) return "activityRequired";
  const duration = parseInt(form.duration, 10);
  if (!Number.isFinite(duration) || duration <= 0) return "durationInvalid";
  if (validity.isDistanceBadInput || isNotANumber(form.distance)) {
    return "distanceInvalid";
  }
  if (validity.isHrBadInput || isNotANumber(form.hr)) return "hrInvalid";
  return null;
}

/** The body of POST /cardio and PUT /cardio/:id; validate first */
export function buildCardioPayload(
  form: CardioForm,
  date: string,
  distanceUnit: DistanceUnit,
): CardioPayload {
  const distance = form.distance.trim();
  const hr = form.hr.trim();
  return {
    date,
    activity: form.activity.trim(),
    duration_min: parseInt(form.duration, 10),
    distance: distance === "" ? null : Number(distance),
    distance_unit: distanceUnit,
    avg_hr: hr === "" ? null : parseInt(hr, 10),
    notes: form.notes.trim() || null,
  };
}

/** The body of POST /cardio that logs a pinned template on `date` */
export function payloadFromTemplate(
  template: CardioSession,
  date: string,
  distanceUnit: DistanceUnit,
): CardioPayload {
  return {
    date,
    activity: template.activity,
    duration_min: template.duration_min,
    distance: template.distance,
    distance_unit: template.distance_unit || distanceUnit,
    avg_hr: template.avg_hr,
    notes: template.notes,
  };
}

export function totalCardioMinutes(sessions: CardioSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.duration_min || 0), 0);
}

export function isPinned(session: CardioSession): boolean {
  return !!session.is_template;
}
