import { describe, expect, it } from "vitest";

import { changedUuids, detailsToSave, EditLog } from "./workoutEdits";

const exercise = (sets: object[]) => ({ uuid: "e1", sets });

describe("edit tracking", () => {
  it("names new and changed exercises and sets only", () => {
    const before = [
      exercise([
        { uuid: "s1", reps: 5 },
        { uuid: "s2", reps: 5 },
      ]),
    ];
    const next = [
      exercise([
        { uuid: "s1", reps: 5 },
        { uuid: "s2", reps: 6 },
      ]),
      { uuid: "e2", sets: [] },
    ];
    expect(changedUuids(before, next)).toEqual({
      exercises: ["e2"],
      sets: { e1: ["s2"] },
    });
  });

  it("keeps edits until a save carrying them reached the server", () => {
    const log = new EditLog();
    const base = { name: "A", exercises: [] };
    log.note("d", base, { ...base, name: "B" });
    const first = log.pending("d");
    expect([...first.fields]).toEqual(["name"]);
    log.note("d", { ...base, name: "B" }, { ...base, name: "B", notes: "x" });
    log.saved("d", first.upTo);
    expect([...log.pending("d").fields]).toEqual(["notes"]);
  });

  it("sends the diary's details only where it changed them", () => {
    const client = { name: "mine", notes: "old", program_id: 1, exercises: [] };
    const server = {
      name: "theirs",
      notes: "new",
      program_id: 2,
      program_week: 3,
      exercises: [],
    };
    expect(detailsToSave(client, server, new Set(["name"]))).toMatchObject({
      name: "mine",
      notes: "new",
      program_id: 2,
      program_week: 3,
    });
    // program, template and week go together
    expect(
      detailsToSave(client, server, new Set(["program_id"])),
    ).toMatchObject({ program_id: 1, program_week: undefined });
  });
});
