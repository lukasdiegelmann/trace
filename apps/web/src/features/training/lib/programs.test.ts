import { describe, expect, it } from "vitest";

import {
  cardProgress,
  clampWeeks,
  moveItem,
  nextCopyName,
  programAccess,
  targetText,
} from "./programs";

describe("nextCopyName", () => {
  it("takes the lowest free suffix without chaining", () => {
    expect(nextCopyName("PPL", [])).toBe("PPL (Copy)");
    expect(nextCopyName("PPL", ["PPL (Copy)"])).toBe("PPL (Copy 2)");
    expect(nextCopyName("PPL (Copy)", ["PPL (Copy)"])).toBe("PPL (Copy 2)");
    expect(nextCopyName("PPL (Copy 3)", ["PPL (Copy)", "PPL (Copy 2)"])).toBe(
      "PPL (Copy 3)",
    );
    expect(nextCopyName("X", ["X (Copy)", "X (Copy 3)"])).toBe("X (Copy 2)");
    expect(nextCopyName(null, [])).toBe("Program (Copy)");
  });
});

describe("program settings", () => {
  it("clamps weeks to 1–52", () => {
    expect(clampWeeks("8")).toBe(8);
    expect(clampWeeks("")).toBe(1);
    expect(clampWeeks(0)).toBe(1);
    expect(clampWeeks(99)).toBe(52);
    expect(clampWeeks("x")).toBe(1);
  });

  it("moves a workout and ignores impossible moves", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
  });
});

describe("programAccess", () => {
  const me = { id: 1, role: "member" };

  it("lets the maker change their program", () => {
    expect(programAccess({ created_by: 1 }, me)).toMatchObject({
      isOwner: true,
      isOthers: false,
      canAssign: false,
    });
    expect(
      programAccess({ created_by: 1 }, { id: 1, role: "trainer" }).canAssign,
    ).toBe(true);
  });

  it("opens someone else's program without editing controls", () => {
    expect(programAccess({ created_by: 2 }, me)).toMatchObject({
      isOwner: false,
      isOthers: true,
    });
  });

  it("gives a shared starter to nobody", () => {
    expect(programAccess({ created_by: null }, me)).toMatchObject({
      isOwner: false,
      isOthers: false,
    });
  });
});

describe("display", () => {
  it("writes a workout's planned sets", () => {
    expect(
      targetText({ target_sets: 3, target_reps: "8-10", target_weight: 60 }),
    ).toBe("3 × 8-10 @ 60");
    expect(
      targetText({ set_type: "time", target_sets: 3, target_duration: "100" }),
    ).toBe("3 × 1:00");
    expect(targetText({})).toBe("");
  });

  it("describes the active program's progress", () => {
    expect(cardProgress({ is_active: 0, weeks_active: 3 })).toBeNull();
    expect(cardProgress({ is_active: 1 })).toBeNull();
    expect(
      cardProgress({
        is_active: 1,
        duration_weeks: 6,
        current_week: 2,
        sessions_in_program: 4,
      }),
    ).toEqual({ week: { current: 2, of: 6 }, sessions: 4 });
    expect(cardProgress({ is_active: 1, weeks_active: 3 })).toEqual({
      week: { current: 3 },
      sessions: 0,
    });
  });
});
