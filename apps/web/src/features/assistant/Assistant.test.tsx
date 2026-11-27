import { ToastProvider } from "@monocircuit/monolithium/components";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import type * as sharedAi from "@/features/shared/ai";
import { setLanguage } from "@/i18n";

import { Assistant } from "./Assistant";

vi.mock("@/features/shared/ai", async (original) => ({
  ...(await original<typeof sharedAi>()),
  useAiSetup: () => ({
    isEnabled: true,
    isUsable: true,
    shouldUseProxy: false,
    assistantName: "Trace",
    config: { provider: "claude", apiKey: "k", model: "", baseUrl: "" },
  }),
}));

function setup() {
  const router = createMemoryRouter(
    [
      { path: "/before", element: <p>before</p> },
      {
        path: "/page",
        element: (
          <ToastProvider>
            <Assistant toolsets={[]} />
          </ToastProvider>
        ),
      },
    ],
    { initialEntries: ["/before", "/page"], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const panel = () => screen.queryByTestId("assistant-backdrop");
const openPanel = () => {
  fireEvent.click(screen.getByRole("button", { name: /Trace/ }));
};

describe("Assistant panel", () => {
  beforeEach(() => {
    setLanguage("en");
    vi.spyOn(api.nt, "get").mockImplementation((path: string) =>
      Promise.resolve(
        path === "/ai/history"
          ? [{ id: 1, role: "assistant", content: "Earlier reply" }]
          : {},
      ),
    );
  });

  it("loads the history when it opens", async () => {
    setup();
    openPanel();
    expect(await screen.findByText("Earlier reply")).toBeInTheDocument();
  });

  it("closes on Back and stays on the page", async () => {
    const router = setup();
    openPanel();
    await waitFor(() => {
      expect(panel()).toBeInTheDocument();
    });
    await router.navigate(-1);
    await waitFor(() => {
      expect(panel()).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe("/page");
  });

  it("closes on a click beside it and on Escape, one step each", async () => {
    const router = setup();
    for (const close of [
      () => {
        fireEvent.click(screen.getByTestId("assistant-backdrop"));
      },
      () => {
        fireEvent.keyDown(window, { key: "Escape" });
        fireEvent.keyDown(window, { key: "Escape" });
      },
    ]) {
      openPanel();
      await waitFor(() => {
        expect(panel()).toBeInTheDocument();
      });
      close();
      await waitFor(() => {
        expect(panel()).not.toBeInTheDocument();
      });
      expect(router.state.location.pathname).toBe("/page");
    }
  });
});
