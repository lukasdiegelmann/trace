import { describe, expect, it, vi } from "vitest";

import { normalizeEquipment, sortByBucket } from "./equipment";
import {
  categoryCounts,
  equipmentOptions,
  filterExercises,
  groupExercises,
  relativeAge,
  sortExercises,
} from "./exerciseList";
import { isTwoFrame, mediaKindOfUrl, youTubeId } from "./exerciseMedia";
import { exerciseRecord, isTimedHistory, topSetPoints } from "./exercisePr";
import {
  buildExerciseShare,
  fetchSharedExercise,
  parseSharePayload,
  rawFileUrl,
} from "./exerciseShare";
import { findSimilarExercises } from "./exerciseSimilarity";

describe("equipment buckets", () => {
  it("maps raw strings in bucket order", () => {
    expect(normalizeEquipment("EZ-bar")).toBe("Barbell");
    expect(normalizeEquipment("Smith machine")).toBe("Barbell");
    expect(normalizeEquipment("body weight")).toBe("Bodyweight");
    expect(normalizeEquipment("none")).toBe("Bodyweight");
    expect(normalizeEquipment("Lever")).toBe("Machine");
    expect(normalizeEquipment("kettlebell")).toBe("Other");
    expect(normalizeEquipment("")).toBe("");
  });

  it("sorts buckets before unknown names", () => {
    expect(
      ["Sandbag", "Other", "Machine", "Anvil", "Barbell"].sort(sortByBucket),
    ).toEqual(["Barbell", "Machine", "Other", "Anvil", "Sandbag"]);
  });
});

const library = [
  { id: 1, name: "Bench Press", category: "chest", equipment: ["Barbell"] },
  { id: 2, name: "Pushup", category: "chest", equipment: ["body only"] },
  {
    id: 3,
    name: "Curl",
    category: "arms",
    equipment: ["dumbbell", "Dumbbell", "Sandbag"],
  },
  { id: 4, name: "Übung", category: null, equipment: [] },
];
const none = { search: "", category: "", equipment: [] };

describe("exercise list", () => {
  it("filters by folded search, category and any selected equipment", () => {
    expect(
      filterExercises(library, { ...none, search: "ubung" }).map((e) => e.id),
    ).toEqual([4]);
    expect(
      filterExercises(library, {
        ...none,
        equipment: ["Bodyweight", "Sandbag"],
      }).map((e) => e.id),
    ).toEqual([2, 3]);
  });

  it("counts categories without the chosen category", () => {
    const counts = categoryCounts(library, { ...none, category: "arms" });
    expect(Object.fromEntries(counts)).toEqual({
      chest: 2,
      arms: 1,
      other: 1,
    });
  });

  it("offers buckets and used custom kit, once per exercise", () => {
    expect(equipmentOptions(library, none, ["Sandbag", "Unused"])).toEqual([
      { name: "Barbell", count: 1, isCustom: false },
      { name: "Bodyweight", count: 1, isCustom: false },
      { name: "Dumbbell", count: 1, isCustom: false },
      { name: "Other", count: 1, isCustom: false },
      { name: "Sandbag", count: 1, isCustom: true },
    ]);
  });

  it("puts favorites first, then the sort mode, then the name", () => {
    const usage = {
      1: { count: 2, last_date: "2026-01-01" },
      2: { count: 5, last_date: "2025-12-01" },
      3: { count: 2, last_date: "2026-02-01" },
    };
    const ids = (mode: "alpha" | "used" | "recent", favorites: number[] = []) =>
      sortExercises(library, mode, usage, favorites).map((e) => e.id);
    expect(ids("alpha")).toEqual([1, 3, 2, 4]);
    expect(ids("used")).toEqual([2, 1, 3, 4]);
    expect(ids("recent")).toEqual([3, 1, 2, 4]);
    expect(ids("used", [4])).toEqual([4, 2, 1, 3]);
  });

  it("groups A→Z by category and flattens the other modes", () => {
    expect(
      groupExercises(library, "alpha", "", {}, []).map((g) => g.category),
    ).toEqual(["chest", "arms", "other"]);
    expect(
      groupExercises(library, "used", "", {}, []).map((g) => g.category),
    ).toEqual([""]);
    expect(groupExercises([], "used", "", {}, [])).toEqual([]);
  });

  it("describes how long ago a day was", () => {
    const now = new Date("2026-03-10T12:00:00").getTime();
    expect(relativeAge("2026-03-10", now)).toEqual({ value: 0, unit: "day" });
    expect(relativeAge("2026-03-09", now)).toEqual({ value: 1, unit: "day" });
    expect(relativeAge("2026-02-24", now)).toEqual({ value: 2, unit: "week" });
    expect(relativeAge("2025-12-10", now)).toEqual({ value: 3, unit: "month" });
    expect(relativeAge("2024-03-10", now)).toEqual({ value: 2, unit: "year" });
  });
});

describe("exercise media", () => {
  it("reads YouTube ids from every link form", () => {
    for (const url of [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(youTubeId(url)).toBe("dQw4w9WgXcQ");
      expect(mediaKindOfUrl(url)).toBe("video");
    }
    expect(youTubeId("https://example.com/a.mp4")).toBe("");
  });

  it("sorts pasted URLs into video, gif and image", () => {
    expect(mediaKindOfUrl("https://x/a.mp4?x=1")).toBe("video");
    expect(mediaKindOfUrl("https://x/a.gif")).toBe("gif");
    expect(mediaKindOfUrl("https://x/a.png")).toBe("img");
  });

  it("detects a start and end frame", () => {
    expect(isTwoFrame({ img_url: "/a/0.jpg", gif_url: "/a/1.jpg" })).toBe(true);
    expect(isTwoFrame({ img_url: "/a/0.jpg", gif_url: "/a/1.gif" })).toBe(
      false,
    );
    expect(isTwoFrame({ img_url: "/a/0.jpg", gif_url: "/a/0.jpg" })).toBe(
      false,
    );
  });
});

describe("exercise record", () => {
  it("takes the heaviest working set, never a warm-up", () => {
    const history = [
      {
        date: "2026-02-02",
        sets: [
          { weight: 200, reps: 1, completed: true, warmup: true },
          { weight: 100, reps: 5, completed: true },
          { weight: 150, reps: 5, completed: false },
        ],
      },
      { date: "2026-01-01", sets: [{ weight: 90, reps: 5, completed: true }] },
    ];
    expect(exerciseRecord(history)).toEqual({
      isTimed: false,
      value: 100,
      weight: 100,
      date: "2026-02-02",
    });
    expect(topSetPoints(history)).toEqual([
      { date: "2026-01-01", value: 90 },
      { date: "2026-02-02", value: 100 },
    ]);
  });

  it("takes the longest hold, the heavier one on a tie", () => {
    const history = [
      {
        date: "2026-02-02",
        set_type: "time",
        sets: [
          { duration_sec: 60, weight: 0, completed: true },
          { duration_sec: 60, weight: 25, completed: true },
          { duration_sec: 45, weight: 50, completed: true },
        ],
      },
      { date: "2026-01-01", sets: [{ weight: 90, reps: 5, completed: true }] },
    ];
    expect(isTimedHistory(history)).toBe(true);
    expect(exerciseRecord(history)).toMatchObject({ value: 60, weight: 25 });
    // The old reps session is not on the hold chart.
    expect(topSetPoints(history)).toEqual([{ date: "2026-02-02", value: 60 }]);
  });

  it("has no record without a completed working set", () => {
    expect(exerciseRecord([])).toBeNull();
  });
});

describe("exercise share", () => {
  const exercise = {
    id: 9,
    name: "Romanian Deadlift (DB)",
    source: "custom",
    created_by: 1,
    tips: null,
    equipment: ["Dumbbell"],
  };

  it("exports only the portable fields with a safe file name", () => {
    const { filename, json } = buildExerciseShare(exercise);
    expect(filename).toBe("romanian-deadlift-db.lifttrace-exercise.json");
    expect(parseSharePayload(json)).toEqual({
      name: "Romanian Deadlift (DB)",
      equipment: ["Dumbbell"],
    });
    expect(buildExerciseShare({ name: "???" }).filename).toBe(
      "exercise.lifttrace-exercise.json",
    );
  });

  it("names every reason a file is refused", () => {
    const cases: [unknown, string][] = [
      ["{", "invalidJson"],
      ["5", "notObject"],
      [{ format: "x" }, "wrongFormat"],
      [{ format: "lifttrace-exercise", version: 2 }, "wrongVersion"],
      [{ format: "lifttrace-exercise", version: 1 }, "missingExercise"],
      [
        { format: "lifttrace-exercise", version: 1, exercise: { name: 3 } },
        "missingName",
      ],
    ];
    for (const [input, code] of cases) {
      expect(() => parseSharePayload(input)).toThrow(
        expect.objectContaining({ code }) as Error,
      );
    }
  });

  it("rewrites GitHub blob links and reports a bad status", async () => {
    expect(rawFileUrl("https://github.com/u/r/blob/main/a/b.json")).toBe(
      "https://raw.githubusercontent.com/u/r/main/a/b.json",
    );
    expect(() => rawFileUrl("ftp://x")).toThrow("urlProtocol");
    const doFetch = vi.fn(() =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    await expect(
      fetchSharedExercise("https://example.com/a.json", doFetch),
    ).rejects.toMatchObject({ code: "badStatus" });
  });
});

describe("similar exercises", () => {
  const source = {
    id: 1,
    name: "Bench",
    primary_muscles: ["Chest"],
    secondary_muscles: ["triceps"],
    equipment: ["Barbell"],
  };
  const others = [
    source,
    { id: 2, name: "Z Fly", primary_muscles: ["chest"], equipment: ["Cable"] },
    {
      id: 3,
      name: "Incline",
      primary_muscles: ["chest"],
      equipment: ["Barbell"],
    },
    {
      id: 4,
      name: "Dip",
      primary_muscles: ["chest", "triceps"],
      equipment: [],
    },
    { id: 5, name: "Squat", primary_muscles: ["quads"] },
  ];

  it("ranks by muscles, penalising other equipment, without itself", () => {
    expect(findSimilarExercises(source, others).map((e) => e.id)).toEqual([
      4, 3, 2,
    ]);
    expect(findSimilarExercises(source, others, 1)).toHaveLength(1);
  });

  it("needs primary muscles on the source", () => {
    expect(findSimilarExercises({ id: 9, name: "x" }, others)).toEqual([]);
  });
});
