import { describe, expect, it } from "vitest";

import {
  ageOn,
  cmToFeetInches,
  dailyTargets,
  feetInchesToCm,
  profileGender,
  readGender,
  round1,
  totalEnergyExpenditure,
  weightFromKg,
  weightToKg,
} from "./body";

describe("units", () => {
  it("converts weights and heights", () => {
    expect(round1(weightToKg(154, "lbs"))).toBe(69.9);
    expect(round1(weightFromKg(69.9, "lb"))).toBe(154.1);
    expect(round1(weightToKg(11, "st"))).toBe(69.9);
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
    expect(feetInchesToCm(5, 11)).toBe(180);
  });

  it("writes each app's spelling of a gender", () => {
    expect(profileGender("nt", "other")).toBe("Prefer not to say");
    expect(profileGender("lt", "non-binary")).toBe("non-binary");
    expect(readGender("Female")).toBe("female");
    expect(readGender("Prefer not to say")).toBe("other");
    expect(readGender(null)).toBe("");
  });
});

describe("daily targets", () => {
  const man = {
    gender: "male",
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activity: "moderate",
  } as const;

  it("uses Mifflin-St Jeor like the old wizard", () => {
    // 1125 + 799.2 - 147.6 + 5 = 1781.6, times 1.55
    expect(totalEnergyExpenditure(man)).toBe(2761);
    expect(totalEnergyExpenditure({ ...man, gender: "female" })).toBe(2504);
  });

  it("cuts or adds 20% when the target is over 1% away", () => {
    expect(dailyTargets(man, 75).calories).toBe(2209);
    expect(dailyTargets(man, 85).calories).toBe(3313);
    expect(dailyTargets(man, 80.5).calories).toBe(2761);
    expect(dailyTargets(man, 80).waterMl).toBe(3300);
    expect(dailyTargets({ ...man, age: 3 }, 80).tdee).toBe(
      dailyTargets({ ...man, age: 15 }, 80).tdee,
    );
  });

  it("counts full years", () => {
    expect(ageOn("2000-06-01", new Date("2026-05-31"))).toBe(25);
    expect(ageOn("", new Date())).toBe(0);
  });
});
