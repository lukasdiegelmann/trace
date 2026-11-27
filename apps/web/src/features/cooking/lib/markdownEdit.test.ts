import { describe, expect, it } from "vitest";

import { prefixLines, wrapSelection } from "./markdownEdit";

describe("formatting", () => {
  it("wraps and unwraps", () => {
    const bold = wrapSelection({ text: "a word b", start: 2, end: 6 }, "**");
    expect(bold).toEqual({ text: "a **word** b", start: 4, end: 8 });
    expect(
      wrapSelection({ text: bold.text, start: 2, end: 10 }, "**").text,
    ).toBe("a word b");
    expect(wrapSelection({ text: "", start: 0, end: 0 }, "*")).toEqual({
      text: "**",
      start: 1,
      end: 1,
    });
  });

  it("prefixes whole lines, skipping empty ones", () => {
    const text = "one\ntwo\n\nthree";
    expect(prefixLines({ text, start: 5, end: 6 }, false).text).toBe(
      "one\n- two\n\nthree",
    );
    expect(prefixLines({ text, start: 0, end: text.length }, true).text).toBe(
      "1. one\n2. two\n\n4. three",
    );
  });
});
