import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { i18n } from "@/i18n";

import { mockLtGet, renderScreen } from "../common/renderScreen";
import { localDay } from "../lib/statistics";
import { ProgressPage } from "./ProgressPage";

const routes = [{ path: "/training/progress", element: <ProgressPage /> }];
const today = localDay();
const photos = {
  photos: [
    { id: 2, date: today, url: "/uploads/body-stats/b.jpg" },
    { id: 1, date: "2026-01-05", url: "/uploads/body-stats/a.jpg" },
  ],
};
const stats = [{ date: "2026-01-05", stats: { weight: 82 } }];

describe("progress photos", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explains an empty timeline", async () => {
    mockLtGet({
      "/body-stats/photos": { photos: [] },
      "/body-stats/range": [],
    });
    renderScreen(routes, "/training/progress");
    expect(
      await screen.findByText(/No progress photos yet/),
    ).toBeInTheDocument();
  });

  it("compares two picked photos, the older one first", async () => {
    mockLtGet({ "/body-stats/photos": photos, "/body-stats/range": stats });
    const user = userEvent.setup();
    renderScreen(routes, "/training/progress");

    expect(await screen.findByText("Jan 5 · 82 lbs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compare two" }));
    const tiles = screen.getAllByRole("button", { name: /^Photo of/ });
    for (const tile of tiles) await user.click(tile);

    expect(
      await screen.findByRole("slider", { name: "Drag to compare" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Earlier photo" })).toHaveAttribute(
      "src",
      "/lt/api/body-stats/photos/1/file",
    );
  });

  it("deletes a photo after the confirmation", async () => {
    mockLtGet({ "/body-stats/photos": photos, "/body-stats/range": stats });
    const remove = vi.spyOn(api.lt, "delete").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderScreen(routes, "/training/progress");

    await user.click(
      await screen.findByRole("button", { name: "Delete photo of Jan 5" }),
    );
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith("/body-stats/photos/1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Jan 5 · 82 lbs")).toBeNull();
    });
  });

  it("logs a missing weight from the timeline of one photo", async () => {
    mockLtGet({ "/body-stats/photos": photos, "/body-stats/range": stats });
    const put = vi.spyOn(api.lt, "put").mockResolvedValue({ stats: {} });
    const user = userEvent.setup();
    renderScreen(routes, "/training/progress");

    const tiles = await screen.findAllByRole("button", { name: /^Photo of/ });
    await user.click(tiles[0]);
    await user.click(await screen.findByRole("button", { name: "Add weight" }));
    await user.type(
      screen.getByRole("spinbutton", { name: "Weight" }),
      "81.5{Enter}",
    );

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(`/body-stats/${today}`, {
        stats: { weight: 81.5 },
      });
    });
  });
});
