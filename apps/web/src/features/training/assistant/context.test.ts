import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";

import { diaryStore, resetDiaryStore } from "../diary/diaryStore";
import { addDays, localDateStr } from "../lib/dates";
import { trainingContext } from "./context";
import { fakeLt } from "./fakeLt";
import { trainingToolset } from "./index";

const today = localDateStr();

beforeEach(() => {
  resetDiaryStore();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the training context", () => {
  it("states the real date, the diary's day, profile and training", async () => {
    const server = fakeLt({
      "/programs": [{ id: 1, name: "PPL", is_active: 1 }],
    });
    vi.spyOn(api.lt, "me").mockResolvedValue({
      user: { id: 1, full_name: "Alex", nickname: "Al", gender: "male" },
    });
    server.rows.push({
      id: 1,
      date: addDays(today, -1),
      name: "Push",
      exercises: [{ sets: [{ completed: true }] }],
    });
    await diaryStore.load(addDays(today, -3));
    const prompt = await trainingContext();
    expect(prompt).toContain("The user tracks weight in kg.");
    expect(prompt).toContain(`, ${today}.`);
    expect(prompt).toContain(
      `The diary is currently open on ${addDays(today, -3)}`,
    );
    expect(prompt).toContain("name: Alex, nickname: Al, gender: male");
    expect(prompt).toContain("Active program: PPL");
    expect(prompt).toContain(
      "Trained on 1 of the last 7 days. Last session: yesterday (Push).",
    );
    expect(prompt).toContain("PLAN: bench press 3x5");
  });

  it("still answers when nothing else loads", async () => {
    vi.spyOn(api.lt, "get").mockRejectedValue(new Error("down"));
    vi.spyOn(api.lt, "me").mockRejectedValue(new Error("down"));
    await expect(trainingContext()).resolves.toContain("no profile data set");
  });
});

describe("the toolset", () => {
  it("offers 'Use this workout' for a reply with a plan only", () => {
    expect(
      trainingToolset.replyAction?.(
        "Here:\nPLAN: squat 5x5 @ 225lbs, dips 3x10 @ BW\nWhy: legs.",
      ),
    ).toEqual({
      label: expect.any(String) as string,
      text: "squat 5x5 @ 225lbs, dips 3x10 @ BW",
    });
    expect(trainingToolset.replyAction?.("My plan: rest")).toBeNull();
  });

  it("has four translated suggestions", () => {
    const suggestions = trainingToolset.suggestions();
    expect(suggestions).toHaveLength(4);
    for (const text of suggestions) expect(text).not.toContain("assistant.");
  });
});
