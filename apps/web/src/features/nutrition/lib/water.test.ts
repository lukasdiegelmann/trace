import { describe, expect, it } from "vitest";

import { displayToMl, mlToDisplay } from "./water";

describe("water units", () => {
  it("converts ml to the display unit with its decimals", () => {
    expect(mlToDisplay(2000, "ml")).toBe(2000);
    expect(mlToDisplay(2000, "oz")).toBe(67.6);
    expect(mlToDisplay(2000, "L")).toBe(2);
    expect(mlToDisplay(2000, "G")).toBe(0.528);
  });

  it("converts back to whole ml", () => {
    expect(displayToMl(67.6, "oz")).toBe(1999);
    expect(displayToMl(1.5, "L")).toBe(1500);
    expect(displayToMl(1, "G")).toBe(3785);
  });
});
