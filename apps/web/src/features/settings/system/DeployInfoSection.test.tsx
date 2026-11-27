import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";

import { DeployInfoSection } from "./DeployInfoSection";

const commit = "cfffa47b0fc4051360bde5eb6d6b3d26d8c04946";
const info = {
  commit,
  commitUrl: `https://git.example.com/me/trace/commit/${commit}`,
  ref: "main",
  builtAt: "2026-11-27T13:49:00Z",
  deployedAt: "2026-11-27T13:50:00Z",
  source: "ci" as const,
  runUrl: "https://ci.example.com/runs/1",
  repoUrl: "https://git.example.com/me/trace",
};

beforeEach(() => i18n.changeLanguage("de"));

describe("DeployInfoSection", () => {
  it("shows the deploy with its links", async () => {
    render(
      <DeployInfoSection
        buildCommit={commit}
        load={() => Promise.resolve(info)}
      />,
    );

    expect(
      await screen.findByRole("link", { name: /cfffa47/ }),
    ).toHaveAttribute("href", info.commitUrl);
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CI-Lauf/ })).toHaveAttribute(
      "href",
      info.runUrl,
    );
    expect(screen.getByRole("link", { name: /Repository/ })).toHaveAttribute(
      "href",
      info.repoUrl,
    );
    expect(screen.queryByText("Neue Version verfügbar")).toBeNull();
  });

  it("offers to reload when another commit is deployed", async () => {
    const reload = vi.fn(() => Promise.resolve());
    render(
      <DeployInfoSection
        buildCommit="d44cde595c5a281238976a7b7304d8e2057db9e9"
        load={() => Promise.resolve({ ...info, source: "manual" })}
        reload={reload}
      />,
    );

    expect(
      await screen.findByText("Neue Version verfügbar"),
    ).toBeInTheDocument();
    expect(screen.getByText("Von Hand")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Neu laden" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("says there is no deploy info without a version.json", async () => {
    render(
      <DeployInfoSection
        buildCommit={commit}
        load={() => Promise.resolve(null)}
      />,
    );

    expect(await screen.findByText("Keine Deploy-Info")).toBeInTheDocument();
    expect(screen.queryByText("Neue Version verfügbar")).toBeNull();
  });
});
