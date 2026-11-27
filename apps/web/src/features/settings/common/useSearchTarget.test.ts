import { describe, expect, it } from "vitest";

import { findSearchTarget } from "./useSearchTarget";

function screen(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML =
    "<h2>Barcode scanning</h2><label>Scan sound</label><label>Crop photos</label>";
  return root;
}

describe("findSearchTarget", () => {
  it("takes the first heading or label with all the words", () => {
    expect(findSearchTarget(screen(), "scan sound")?.textContent).toBe(
      "Scan sound",
    );
  });

  it("falls back to one of the words", () => {
    expect(findSearchTarget(screen(), "crop nothing")?.textContent).toBe(
      "Crop photos",
    );
  });

  it("finds nothing for a keyword the screen doesn't show", () => {
    expect(findSearchTarget(screen(), "passwort")).toBeNull();
    expect(findSearchTarget(screen(), " ")).toBeNull();
  });
});
