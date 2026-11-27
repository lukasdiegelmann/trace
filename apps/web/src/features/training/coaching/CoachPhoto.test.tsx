import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";

import { CoachPhoto } from "./CoachPhoto";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CoachPhoto", () => {
  it("fetches the private photo through /lt and says when it is gone", async () => {
    await i18n.changeLanguage("en");
    const fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 404 })),
    );
    vi.stubGlobal("fetch", fetch);

    render(<CoachPhoto path="/api/coaching/photos/gone.jpg" />);

    expect(
      await screen.findByText("This photo is no longer available"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/lt/api/coaching/photos/gone.jpg", {
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("says a photo shows up again once there is a connection", async () => {
    await i18n.changeLanguage("en");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );

    render(<CoachPhoto path="/api/coaching/photos/later.jpg" />);

    expect(
      await screen.findByText("Shown when you're back online"),
    ).toBeInTheDocument();
  });

  it("shows a photo still to be sent as it is", async () => {
    await i18n.changeLanguage("en");

    render(<CoachPhoto path="data:image/png;base64,AA==" />);

    expect(await screen.findByAltText("Photo")).toHaveAttribute(
      "src",
      "data:image/png;base64,AA==",
    );
  });
});
