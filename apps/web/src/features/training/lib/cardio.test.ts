import { describe, expect, it } from "vitest";

import {
  buildCardioPayload,
  cardioDistanceUnit,
  cardioFormFromSession,
  EMPTY_CARDIO_FORM,
  payloadFromTemplate,
  totalCardioMinutes,
  validateCardioForm,
} from "./cardio";

const session = {
  id: 1,
  date: "2026-11-01",
  activity: "Bike",
  duration_min: 30,
  distance: 12.5,
  distance_unit: null,
  avg_hr: 140,
  notes: null,
};

describe("cardio", () => {
  it("validates in the old order", () => {
    expect(validateCardioForm(EMPTY_CARDIO_FORM)).toBe("activityRequired");
    const run = { ...EMPTY_CARDIO_FORM, activity: "Run" };
    expect(validateCardioForm(run)).toBe("durationInvalid");
    expect(validateCardioForm({ ...run, duration: "0" })).toBe(
      "durationInvalid",
    );
    const timed = { ...run, duration: "20" };
    expect(validateCardioForm({ ...timed, distance: "x" })).toBe(
      "distanceInvalid",
    );
    expect(validateCardioForm(timed, { isHrBadInput: true })).toBe("hrInvalid");
    expect(validateCardioForm(timed)).toBeNull();
  });

  it("builds the payload with nulls for blanks", () => {
    expect(
      buildCardioPayload(
        { ...EMPTY_CARDIO_FORM, activity: " Run ", duration: "20" },
        "2026-11-26",
        cardioDistanceUnit("kg"),
      ),
    ).toEqual({
      date: "2026-11-26",
      activity: "Run",
      duration_min: 20,
      distance: null,
      distance_unit: "km",
      avg_hr: null,
      notes: null,
    });
    expect(cardioDistanceUnit("lbs")).toBe("mi");
  });

  it("prefills the form and logs templates", () => {
    expect(cardioFormFromSession(session)).toMatchObject({
      duration: "30",
      distance: "12.5",
      hr: "140",
      notes: "",
    });
    expect(payloadFromTemplate(session, "2026-11-26", "mi")).toMatchObject({
      date: "2026-11-26",
      distance_unit: "mi",
      distance: 12.5,
    });
    expect(totalCardioMinutes([session, session])).toBe(60);
  });
});
