import { describe, expect, it } from "vitest";

import { formatStepText } from "./stepFormat";

describe("formatStepText", () => {
  it("reads bold, italic and underline, nested", () => {
    expect(formatStepText("a **b __c__** *d*")).toEqual([
      "a ",
      { mark: "strong", children: ["b ", { mark: "u", children: ["c"] }] },
      " ",
      { mark: "em", children: ["d"] },
    ]);
  });

  it("leaves markup as text", () => {
    expect(formatStepText("<img src=x>")).toEqual(["<img src=x>"]);
    expect(formatStepText("")).toEqual([]);
  });
});
