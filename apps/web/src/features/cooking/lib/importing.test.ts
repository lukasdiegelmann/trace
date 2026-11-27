import { describe, expect, it } from "vitest";

import {
  confidenceOf,
  fileKind,
  isScan,
  parseUrlList,
  readImportAnswer,
  routeFiles,
} from "./importing";

const file = (name: string, type = "") => ({ name, type });

describe("importing", () => {
  it("splits and deduplicates URLs", () => {
    expect(parseUrlList(" a.test/1,\nb.test  a.test/1 ")).toEqual([
      "a.test/1",
      "b.test",
    ]);
    expect(parseUrlList("  ")).toEqual([]);
  });

  it("routes files by kind and count", () => {
    expect(fileKind(file("a.ZIP"))).toBe("zip");
    expect(fileKind(file("a.jpg", "image/jpeg"))).toBe("image");
    expect(routeFiles([file("a.pdf")])).toBe("single");
    expect(routeFiles([file("a.zip")])).toBe("bulk");
    expect(routeFiles([file("a.pdf"), file("b.txt")])).toBe("bulk");
    expect(routeFiles([file("a.exe")])).toBe("unsupported");
    expect(routeFiles([])).toBe("none");
  });

  it("grades the parser's confidence", () => {
    expect(confidenceOf(0.7, 0.7)).toBe("clean");
    expect(confidenceOf(0.4, 0.7)).toBe("partial");
    expect(confidenceOf(0.1, 0.7)).toBe("bestEffort");
  });

  it("sees a scan behind the PDF library's page marks", () => {
    const pdf = (text: string) => ({ type: "pdf", text, empty: false });
    expect(isScan(pdf("-- 1 of 2 --\n\n-- 2 of 2 --"))).toBe(true);
    expect(isScan(pdf("Soup\n-- 1 of 1 --"))).toBe(false);
    expect(isScan({ type: "txt", text: "-- 1 of 1 --", empty: false })).toBe(
      false,
    );
    expect(isScan({ type: "txt", text: "", empty: true })).toBe(true);
  });

  it("tells the three answers apart", () => {
    expect(readImportAnswer({ id: 3, steps: [{ text: " " }] })).toEqual({
      kind: "recipe",
      id: 3,
      hasSteps: false,
    });
    expect(readImportAnswer({ skipped: true, existing_id: 9 })).toEqual({
      kind: "duplicate",
      existingId: 9,
    });
    expect(
      readImportAnswer({ recipes: [{}], count: 1, skipped: [{}, {}] }),
    ).toEqual({ kind: "archive", count: 1, skipped: 2 });
  });
});
