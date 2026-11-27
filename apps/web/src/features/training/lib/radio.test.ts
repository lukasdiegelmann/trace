import { describe, expect, it } from "vitest";

import {
  availableTabs,
  browsedStationId,
  canMove,
  deleteStation,
  dropOnGroup,
  dropOnStation,
  existingGroups,
  existingStationUrls,
  fmtDuration,
  fmtTime,
  groupKey,
  groupStations,
  isAlreadyAdded,
  isMusicAvailable,
  moveStation,
  parseStations,
  parseViewState,
  radioBrowserSubtitle,
  radioBrowserToStation,
  renameGroup,
  resolveTab,
  shouldShowRadioNav,
  starArgs,
  starKey,
  starredIdSet,
  stationFromForm,
  stationStreamUrl,
  stationToTrack,
  upsertStation,
  type Station,
} from "./radio";

function station(id: string, group = "", url = `https://s/${id}`): Station {
  return {
    id,
    name: id.toUpperCase(),
    url,
    genre: "",
    iconUrl: "",
    group,
    homepage: "",
  };
}

const ids = (list: Station[]) => list.map((entry) => entry.id);
const list = [
  station("a", "Chill"),
  station("b"),
  station("c", "Workout"),
  station("d", " Chill "),
];

describe("stations", () => {
  it("reads the setting and keeps fields it doesn't know", () => {
    expect(
      parseStations([{ id: "a", name: "A", url: "u", extra: 1 }, 5, null]),
    ).toEqual([
      {
        id: "a",
        name: "A",
        url: "u",
        genre: "",
        iconUrl: "",
        group: "",
        homepage: "",
        extra: 1,
      },
    ]);
    expect(parseStations(undefined)).toEqual([]);
  });

  it("groups in order of appearance, the ungrouped last", () => {
    expect(
      groupStations(list).map((group) => [group.name, ids(group.stations)]),
    ).toEqual([
      ["Chill", ["a", "d"]],
      ["Workout", ["c"]],
      ["", ["b"]],
    ]);
    expect(groupKey(" ")).toBe("__ungrouped__");
    expect(existingGroups(list)).toEqual(["Chill", "Workout"]);
  });

  it("moves within the group only", () => {
    expect(ids(moveStation(list, "a", "down"))).toEqual(["d", "b", "c", "a"]);
    expect(canMove(list, "a", "down")).toBe(true);
    expect(canMove(list, "a", "up")).toBe(false);
    expect(canMove(list, "c", "down")).toBe(false);
    expect(ids(moveStation(list, "c", "up"))).toEqual(ids(list));
    expect(canMove(list, "zz", "up")).toBe(false);
  });

  it("drops before a station and takes its group", () => {
    const moved = dropOnStation(list, "b", "c");
    expect(ids(moved)).toEqual(["a", "b", "c", "d"]);
    expect(moved[1].group).toBe("Workout");
    expect(list[1].group).toBe("");
    expect(ids(dropOnStation(list, "a", "a"))).toEqual(ids(list));
  });

  it("drops on a group after its last station", () => {
    const moved = dropOnGroup(list, "c", "Chill");
    expect(ids(moved)).toEqual(["a", "b", "d", "c"]);
    expect(moved[3].group).toBe("Chill");
    expect(ids(dropOnGroup(list, "a", "New"))).toEqual(["b", "c", "d", "a"]);
  });

  it("renames a group by its trimmed name; empty ungroups", () => {
    expect(
      renameGroup(list, "Chill", " Calm ").map((entry) => entry.group),
    ).toEqual(["Calm", "", "Workout", "Calm"]);
    expect(renameGroup(list, "Chill", "")[0].group).toBe("");
  });

  it("replaces in place, appends and deletes", () => {
    const edited = upsertStation(list, { ...station("b"), name: "Bee" });
    expect(ids(edited)).toEqual(ids(list));
    expect(edited[1].name).toBe("Bee");
    expect(ids(upsertStation(list, station("e"))).at(-1)).toBe("e");
    expect(ids(deleteStation(list, "b"))).toEqual(["a", "c", "d"]);
  });

  it("wants a name and a URL, and trims", () => {
    const form = { ...station("x"), name: " N ", url: " u ", genre: " g " };
    expect(stationFromForm(form, "station:1")).toMatchObject({
      id: "station:1",
      name: "N",
      url: "u",
      genre: "g",
    });
    expect(stationFromForm({ ...form, name: " " }, "1")).toBeNull();
    expect(stationFromForm({ ...form, url: "" }, "1")).toBeNull();
  });

  it("makes a station of a directory result", () => {
    const result = {
      name: "",
      url: "http://a",
      url_resolved: "http://b ",
      favicon: "http://icon",
      tags: "jazz, ,chill,smooth",
      homepage: "http://home",
      country: "Italy",
      bitrate: 128,
    };
    expect(radioBrowserToStation(result, "station:1:x")).toEqual({
      id: "station:1:x",
      name: "Unnamed",
      url: "http://b ",
      genre: "jazz / chill",
      iconUrl: "http://icon",
      group: "",
      homepage: "http://home",
    });
    expect(radioBrowserSubtitle(result)).toBe("Italy · 128 kbps · jazz, chill");
    const urls = existingStationUrls([station("a", "", " http://b")]);
    expect(isAlreadyAdded(result, urls)).toBe(true);
    expect(isAlreadyAdded({ url: "http://other" }, urls)).toBe(false);
    expect(browsedStationId(5, () => 0.5)).toBe("station:5:i");
  });

  it("proxies every stream but HLS", () => {
    expect(stationStreamUrl({ url: "http://a/s?x=1" })).toBe(
      "/lt/api/radio-proxy?url=http%3A%2F%2Fa%2Fs%3Fx%3D1",
    );
    expect(stationStreamUrl({ url: "http://a/l.m3u8" })).toBe(
      "http://a/l.m3u8",
    );
    expect(stationToTrack(station("a"), "Radio station")).toEqual({
      id: "a",
      title: "A",
      artist: "Radio station",
      album: "",
      coverUrl: "",
      streamUrl: "/lt/api/radio-proxy?url=https%3A%2F%2Fs%2Fa",
      transcodeUrl: null,
      duration: 0,
      isStream: true,
      originalUrl: "https://s/a",
    });
  });
});

describe("times", () => {
  it("formats minutes and seconds", () => {
    expect(fmtDuration(0)).toBe("");
    expect(fmtDuration(undefined)).toBe("");
    expect(fmtDuration(125)).toBe("2:05");
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(Number.NaN)).toBe("0:00");
    expect(fmtTime(61.9)).toBe("1:01");
  });
});

describe("visibility", () => {
  const all = { hasMusic: true, hasStations: true, hasStars: true };

  it("needs music or stations for the section", () => {
    expect(isMusicAvailable(true, "")).toBe(false);
    expect(isMusicAvailable(false, "http://x")).toBe(false);
    expect(isMusicAvailable(true, "http://x")).toBe(true);
    expect(shouldShowRadioNav(false, "", true)).toBe(true);
    expect(shouldShowRadioNav(true, "", false)).toBe(false);
  });

  it("offers the tabs that work", () => {
    expect(availableTabs(all)).toEqual([
      "albums",
      "artists",
      "playlists",
      "starred",
      "stations",
    ]);
    expect(
      availableTabs({ ...all, hasStars: false, hasStations: false }),
    ).toEqual(["albums", "artists", "playlists"]);
    expect(availableTabs({ ...all, hasMusic: false })).toEqual(["stations"]);
  });

  it("falls back or redirects", () => {
    expect(
      resolveTab("albums", { ...all, hasMusic: false, hasStations: false }),
    ).toBe("redirect");
    expect(resolveTab("search", { ...all, hasMusic: false })).toBe("stations");
    expect(resolveTab("stations", { ...all, hasStations: false })).toBe(
      "albums",
    );
    expect(resolveTab("starred", { ...all, hasStars: false })).toBe("albums");
    expect(resolveTab("artists", all)).toBe("artists");
  });

  it("reads the saved view", () => {
    expect(parseViewState("nonsense")).toMatchObject({
      tab: null,
      stationsSubTab: "my",
      search: "",
      selectedAlbumId: null,
      scrollY: 0,
    });
    expect(
      parseViewState(
        '{"tab":"artists","stationsSubTab":"browse","search":"q","selectedAlbumId":4,"scrollY":12}',
      ),
    ).toMatchObject({
      tab: "artists",
      stationsSubTab: "browse",
      search: "q",
      selectedAlbumId: "4",
      scrollY: 12,
    });
  });
});

describe("favorites", () => {
  it("keys and arguments by kind", () => {
    expect(starKey("song", "1")).toBe("1");
    expect(starKey("album", "1")).toBe("album:1");
    expect(starKey("artist", "1")).toBe("artist:1");
    expect(starArgs("song", "1")).toEqual({ id: "1" });
    expect(starArgs("album", "1")).toEqual({ albumId: "1" });
    expect(starArgs("artist", "1")).toEqual({ artistId: "1" });
    expect(
      starredIdSet({
        songs: [{ id: "s" }],
        albums: [{ id: "a" }],
        artists: [{ id: "r" }],
      }),
    ).toEqual(new Set(["s", "album:a", "artist:r"]));
  });
});
