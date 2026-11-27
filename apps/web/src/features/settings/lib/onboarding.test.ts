import { describe, expect, it } from "vitest";

import {
  energyUnitFor,
  liftProfile,
  needsSetup,
  setupBody,
  unitsFor,
} from "./onboarding";

describe("setup assistant", () => {
  it("opens only for a fresh account", () => {
    expect(needsSetup({})).toBe(true);
    expect(needsSetup({ goals: {} })).toBe(true);
    expect(needsSetup({ goals: { calories: {} } })).toBe(false);
    expect(needsSetup({ setupComplete: true, goals: {} })).toBe(false);
  });

  it("takes body data from LiftTrace where NutriTrace has none", () => {
    expect(
      setupBody(
        { weight_kg: "", height_cm: 180, gender: "male" },
        { currentWeightKg: 81.5, heightCm: 170, dob: "1990-05-01" },
      ),
    ).toMatchObject({
      weightKg: 81.5,
      heightCm: 180,
      gender: "male",
      birthday: "1990-05-01",
    });
  });

  it("gives LiftTrace's profile what is known, targets or not", () => {
    expect(liftProfile({ gender: "female", birthday: "" })).toEqual({
      gender: "female",
    });
    expect(liftProfile({ gender: "", birthday: "" })).toBeNull();
  });

  it("sets every unit from one choice", () => {
    expect(unitsFor("imperial", "en-US")).toMatchObject({
      weightUnit: "lb",
      liftWeightUnit: "lbs",
      waterUnit: "oz",
      energyUnit: "kcal",
    });
    expect(unitsFor("metric", "de-DE").tempUnit).toBe("C");
    expect(energyUnitFor("en-AU")).toBe("kJ");
    expect(energyUnitFor("en-GB")).toBe("kcal");
  });
});
