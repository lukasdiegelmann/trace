import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";
import { fakeFetch } from "@/test/fakeFetch";

import { playerStore } from "./player";
import { RadioMiniPlayer } from "./RadioMiniPlayer";
import { RadioPage } from "./RadioPage";
import { stopRadio } from "./stopRadio";
import { stubMedia } from "./testMedia";

const stations = [
  {
    id: "station:1",
    name: "Groove Salad",
    url: "http://soma.example/groove",
    genre: "Ambient",
    iconUrl: "",
    group: "Chill",
    homepage: "",
  },
];

const music = {
  radioEnabled: true,
  radioProvider: "subsonic",
  radioUrl: "http://music.example",
  radioUser: "joe",
  radioPassword: "secret",
  radioStationsEnabled: true,
  radioStations: stations,
};

let isServerDown = false;
let libraryCalls: string[] = [];

function subsonic(url: string) {
  const method = /\/rest\/(\w+)/.exec(url)?.[1] ?? "";
  libraryCalls.push(method);
  const songs = [
    { id: "s1", title: "La femme d'argent", artist: "Air", duration: 429 },
    { id: "s2", title: "Sexy Boy", artist: "Air", duration: 298 },
  ];
  const replies: Record<string, object> = {
    getAlbumList2: {
      albumList2: {
        album: [{ id: "al", name: "Moon Safari", artist: "Air" }],
      },
    },
    getAlbum: {
      album: { id: "al", name: "Moon Safari", artist: "Air", song: songs },
    },
    getStarred2: { starred2: { song: [songs[1]] } },
    star: {},
  };
  if (isServerDown) return { status: 502, body: { error: "Server is down" } };
  return {
    body: { "subsonic-response": { status: "ok", ...replies[method] } },
  };
}

async function open(settings: object) {
  vi.spyOn(api.lt, "get").mockImplementation((path) =>
    Promise.resolve((path === "/settings" ? settings : {}) as never),
  );
  await settingsStores.lt.reload();
  const router = createMemoryRouter(
    [
      {
        path: "/training/radio",
        element: (
          <main>
            <RadioPage />
            <RadioMiniPlayer />
          </main>
        ),
      },
      { path: "/settings", element: <p>Settings page</p> },
    ],
    { initialEntries: ["/training/radio"] },
  );
  const view = render(
    <ZLayerProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ZLayerProvider>,
  );
  return { ...view, router, user: userEvent.setup() };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  isServerDown = false;
  libraryCalls = [];
  stubMedia();
  vi.stubGlobal("fetch", fakeFetch((call) => subsonic(call.url)).fetch);
  vi.spyOn(api.lt, "put").mockResolvedValue({ ok: true });
});

afterEach(async () => {
  act(() => {
    stopRadio();
  });
  await settingsStores.lt.flush();
  vi.unstubAllGlobals();
});

describe("RadioPage", () => {
  it("leaves for the settings when music and stations are off", async () => {
    await open({});
    expect(await screen.findByText("Settings page")).toBeInTheDocument();
  });

  it("shows only the stations without a music server", async () => {
    await open({ radioStationsEnabled: true, radioStations: stations });
    expect(await screen.findByText("Groove Salad")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Albums" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Search library" })).toBeNull();
    expect(libraryCalls).toEqual([]);
  });

  it("opens an album, plays it and shows the player bar", async () => {
    const { user } = await open(music);
    await user.click(await screen.findByText("Moon Safari"));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Moon Safari" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Remove Sexy Boy from favorites",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Play All" }));
    const bar = await screen.findByRole("region", { name: "Music player" });
    expect(within(bar).getByText("La femme d'argent")).toBeInTheDocument();
    expect(playerStore.getSnapshot().queue).toHaveLength(2);

    await user.click(within(bar).getByRole("button", { name: /Open player/ }));
    const sheet = await screen.findByRole("dialog");
    await user.click(
      within(sheet).getByRole("button", { name: "Queue · 1 of 2" }),
    );
    await user.click(
      within(sheet).getByRole("button", { name: "Play Sexy Boy" }),
    );
    expect(playerStore.getSnapshot().queueIndex).toBe(1);
  });

  it("stars a song and takes it back when the server refuses", async () => {
    const { user } = await open(music);
    await user.click(await screen.findByText("Moon Safari"));
    const star = await screen.findByRole("button", {
      name: "Add La femme d'argent to favorites",
    });
    isServerDown = true;
    await user.click(star);
    expect(await screen.findByText("Server is down")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Add La femme d'argent to favorites",
      }),
    ).toBeInTheDocument();
  });

  it("offers a retry when the music server can't be reached", async () => {
    isServerDown = true;
    const { user } = await open(music);
    expect(
      await screen.findByText("Couldn't reach your media server."),
    ).toBeInTheDocument();
    expect(screen.getByText("Albums: Server is down")).toBeInTheDocument();
    isServerDown = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Moon Safari")).toBeInTheDocument();
  });

  it("brings back the open album after leaving the page", async () => {
    const first = await open(music);
    await first.user.click(await screen.findByText("Moon Safari"));
    await screen.findByText("Sexy Boy");
    first.unmount();
    await open(music);
    expect(await screen.findByText("Sexy Boy")).toBeInTheDocument();
  });

  it("plays a station through the proxy", async () => {
    const { user } = await open({
      radioStationsEnabled: true,
      radioStations: stations,
    });
    await user.click(await screen.findByText("Groove Salad"));
    expect(playerStore.getSnapshot().currentTrack).toMatchObject({
      isStream: true,
      streamUrl: "/lt/api/radio-proxy?url=http%3A%2F%2Fsoma.example%2Fgroove",
    });
  });

  it("adds a station once name and URL are there", async () => {
    const { user } = await open({ radioStationsEnabled: true });
    await user.click(
      await screen.findByRole("button", { name: "Add station" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Name and URL are required"),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Name"), " New FM ");
    await user.type(
      within(dialog).getByLabelText("Stream URL"),
      "http://new.example/live",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Station added")).toBeInTheDocument();
    expect(settingsStores.lt.get("radioStations")).toMatchObject([
      { name: "New FM", url: "http://new.example/live", group: "" },
    ]);
  });

  it("deletes a station only after asking", async () => {
    const { user } = await open({
      radioStationsEnabled: true,
      radioStations: stations,
    });
    await user.click(
      await screen.findByRole("button", { name: "Delete Groove Salad" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(settingsStores.lt.get("radioStations")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(settingsStores.lt.get("radioStations")).toEqual([]);
    });
    expect(screen.getByText(/No stations yet/)).toBeInTheDocument();
  });

  it("searches the directory and adds a result", async () => {
    const { user } = await open({ radioStationsEnabled: true });
    await user.click(await screen.findByRole("button", { name: "Browse" }));
    vi.stubGlobal(
      "fetch",
      fakeFetch(() => ({
        body: [{ name: "Jazz24", url: "http://jazz", country: "USA" }],
      })).fetch,
    );
    await user.type(
      screen.getByLabelText("Search the station directory"),
      "jazz",
    );
    await user.click(await screen.findByRole("button", { name: "Add Jazz24" }));
    expect(await screen.findByText("Added")).toBeInTheDocument();
    expect(settingsStores.lt.get("radioStations")).toMatchObject([
      { name: "Jazz24", url: "http://jazz" },
    ]);
  });

  it("has a track menu on right-click", async () => {
    const { user } = await open(music);
    await user.click(await screen.findByText("Moon Safari"));
    await user.pointer({
      keys: "[MouseRight]",
      target: await screen.findByText("Sexy Boy"),
    });
    await user.click(
      await screen.findByRole("menuitem", { name: "Add to queue" }),
    );
    expect(await screen.findByText("Added to queue")).toBeInTheDocument();
    expect(playerStore.getSnapshot().queue).toMatchObject([{ id: "s2" }]);
  });
});
