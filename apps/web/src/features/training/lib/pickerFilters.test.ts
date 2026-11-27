import { describe, expect, it } from "vitest";

import { filterExercises } from "./exerciseList";
import {
  EMPTY_FILTERS,
  hasExactMatch,
  parseStoredFilters,
  toListFilters,
} from "./pickerFilters";

const rows = [
  { id: 1, name: "Bench Press", category: "chest", equipment: ["EZ-bar"] },
  { id: 2, name: "Crème Squat", category: "legs", equipment: ["body only"] },
];

describe("picker filters", () => {
  it("searches trimmed and accents aside, with category and bucket", () => {
    const names = (filters: Partial<typeof EMPTY_FILTERS>) =>
      filterExercises(
        rows,
        toListFilters({ ...EMPTY_FILTERS, ...filters }),
      ).map((row) => row.name);
    expect(names({ search: "bench " })).toEqual(["Bench Press"]);
    expect(names({ search: "creme" })).toEqual(["Crème Squat"]);
    expect(names({ category: "legs" })).toEqual(["Crème Squat"]);
    expect(names({ equipment: "Barbell" })).toEqual(["Bench Press"]);
    expect(names({})).toHaveLength(2);
  });

  it("finds an exact name, case aside", () => {
    expect(hasExactMatch(rows, " bench press ")).toBe(true);
    expect(hasExactMatch(rows, "bench")).toBe(false);
  });

  it("reads stored filters and survives rubbish", () => {
    expect(parseStoredFilters('{"search":"a","category":3}')).toEqual({
      search: "a",
      category: "",
      equipment: "",
    });
    expect(parseStoredFilters("{nope")).toEqual(EMPTY_FILTERS);
    expect(parseStoredFilters(null)).toEqual(EMPTY_FILTERS);
  });
});
