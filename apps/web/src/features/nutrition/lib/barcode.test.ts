import { describe, expect, it } from "vitest";

import {
  findByBarcode,
  isSameBarcode,
  normalizeScannedBarcode,
} from "./barcode";

describe("barcodes", () => {
  it("pads a scanned UPC-A to EAN-13", () => {
    expect(normalizeScannedBarcode("036000291452")).toBe("0036000291452");
    expect(normalizeScannedBarcode(" 4006381333931 ")).toBe("4006381333931");
    expect(normalizeScannedBarcode("fdcId_1")).toBe("fdcId_1");
  });

  it("ignores leading zeros when matching", () => {
    expect(isSameBarcode("0036000291452", "36000291452")).toBe(true);
    expect(isSameBarcode("", "")).toBe(false);
    expect(isSameBarcode(null, "1")).toBe(false);
    expect(findByBarcode([{ barcode: "01" }], "1")).toEqual({ barcode: "01" });
    expect(findByBarcode([{ barcode: null }], "1")).toBeNull();
  });
});
