import { describe, expect, it } from "vitest";

import { dominantColor } from "./radioColor";

describe("dominantColor", () => {
  it("averages the pixels that are neither near black nor near white", () => {
    expect(
      dominantColor([
        100, 50, 0, 255, 200, 100, 50, 255, 0, 0, 0, 255, 255, 255, 255, 255,
      ]),
    ).toBe("rgb(150, 75, 25)");
  });

  it("answers nothing when every pixel is extreme", () => {
    expect(dominantColor([0, 0, 0, 255, 250, 250, 250, 255])).toBeNull();
    expect(dominantColor([])).toBeNull();
  });
});
