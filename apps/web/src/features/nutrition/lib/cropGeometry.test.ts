import { describe, expect, it } from "vitest";

import {
  centeredSquareCrop,
  moveSquareCrop,
  resizeSquareCrop,
} from "./cropGeometry";

// Upstream crop-geometry.test.js
describe("square crop", () => {
  it("starts centred", () => {
    expect(centeredSquareCrop(400, 300)).toEqual({ x: 80, y: 30, size: 240 });
    expect(centeredSquareCrop(200, 500)).toEqual({ x: 20, y: 170, size: 160 });
  });

  it("stays inside the image when moved", () => {
    expect(
      moveSquareCrop({ x: 20, y: 30, size: 160 }, -100, 500, 300, 250),
    ).toEqual({ x: 0, y: 90, size: 160 });
  });

  it("resizes within the minimum and the bounds", () => {
    const crop = { x: 40, y: 30, size: 160 };
    expect(resizeSquareCrop(crop, 200, 100, 300, 260)).toEqual({
      x: 40,
      y: 30,
      size: 230,
    });
    expect(resizeSquareCrop(crop, -500, -300, 300, 260)).toEqual({
      x: 40,
      y: 30,
      size: 48,
    });
  });
});
