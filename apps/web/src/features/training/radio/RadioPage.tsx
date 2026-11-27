/**
 * Music from the self-hosted server and internet radio, after
 * backends/lifttrace/src/routes/Radio.svelte.
 */
import {
  Button,
  Input,
  Row,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeft,
  Disc3,
  ListMusic,
  Radio,
  Search,
  Shuffle,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";

import { settingsStores } from "@/features/shared/settings";

import {
  availableTabs,
  parseStations,
  parseViewState,
  RADIO_STATE_KEY,
  resolveTab,
  stationToTrack,
  type RadioFeatures,
  type RadioTab,
  type RadioViewState,
  type Station,
} from "../lib/radio";
import { BrowseStations } from "./BrowseStations";
import { EmptyNote } from "../common/EmptyNote";
import { LibraryContent } from "./LibraryContent";
import { getLibrary, type LibrarySession } from "./libraryCache";
import { MyStations } from "./MyStations";
import { NowPlayingPanel } from "./NowPlayingPanel";
import { playTrack } from "./player";
import { useIsRadioWide } from "./useIsRadioWide";
import { isLibraryTab, useLibrary } from "./useLibrary";
import { useRadioSettings, type RadioSettings } from "./useRadioSettings";

function readViewState(): RadioViewState {
  try {
    return parseViewState(sessionStorage.getItem(RADIO_STATE_KEY));
  } catch {
    return parseViewState(null);
  }
}

export function RadioPage() {
  const { t } = useTranslation("training");
  const settings = useRadioSettings();
  // A later reload must not take the page away again
  const [isLoaded, setIsLoaded] = useState(settings.status === "ready");
  if (!isLoaded && settings.status === "ready") setIsLoaded(true);
  const unknownArtist = t("player.unknownArtist");
  const session = useMemo(
    () => (isLoaded ? getLibrary(settings.config, unknownArtist) : null),
    [isLoaded, settings.config, unknownArtist],
  );

  if (!session) {
    return settings.status === "error" ? (
      <EmptyNote
        text={t("common.loadFailed", {
          message: settings.error?.message ?? "",
        })}
      >
        <Button
          variant="secondary"
          size="sm"
          text={t("common.retry")}
          onClick={() => void settings.reload()}
        />
      </EmptyNote>
    ) : (
      <Stack align="center" paddingY={8}>
        <Spinner size="lg" label={t("common.loading")} />
      </Stack>
    );
  }
  // Music and stations are separate; without both there is nothing here
  if (!settings.hasMusic && !settings.hasStations) {
    return <Navigate to="/settings" replace />;
  }
  return <RadioView key={session.key} session={session} settings={settings} />;
}

const TAB_ICONS: Record<RadioTab, LucideIcon> = {
  albums: Disc3,
  artists: User,
  playlists: ListMusic,
  starred: Star,
  search: Search,
  stations: Radio,
};

interface RadioViewProps {
  session: LibrarySession;
  settings: RadioSettings;
}

function RadioView({ session, settings }: RadioViewProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const isWide = useIsRadioWide();
  const library = useLibrary(session);
  const { stations, saveStations, hasMusic, hasStations } = settings;
  const features: RadioFeatures = {
    hasMusic,
    hasStations,
    hasStars: session.client.hasStars,
  };

  const [saved] = useState(readViewState);
  const allowed = (wanted: RadioTab): RadioTab => {
    const resolved = resolveTab(wanted, features);
    return resolved === "redirect" ? "stations" : resolved;
  };
  const [wantedTab, setTab] = useState<RadioTab>(() =>
    allowed(saved.tab ?? (hasMusic ? "albums" : "stations")),
  );
  const tab = allowed(wantedTab);
  // What the tab needs was switched off: stay on the one shown instead
  const [forced, setForced] = useState<{ tab: RadioTab } | null>(null);
  if (tab !== wantedTab) {
    setTab(tab);
    setForced({ tab });
  }
  const [subTab, setSubTab] = useState(saved.stationsSubTab);
  const [search, setSearch] = useState(saved.search);

  const { details } = library;
  const detailName =
    details.album?.name || details.artist?.name || details.playlist?.name;
  const hasDetail = Boolean(
    details.album || details.artist || details.playlist,
  );

  // ── Saved view and scroll position ────────────────────────────────────
  const root = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(saved.scrollY);
  const [isRestored, setIsRestored] = useState(false);
  const view = useRef<Omit<RadioViewState, "scrollY"> | null>(null);

  const save = useRef(() => {
    if (!view.current) return;
    try {
      sessionStorage.setItem(
        RADIO_STATE_KEY,
        JSON.stringify({ ...view.current, scrollY: scrollTop.current }),
      );
    } catch {
      // blocked storage: nothing survives leaving the page
    }
  });

  useEffect(() => {
    // Until the saved details are open again, the saved view stands
    if (!isRestored) return;
    view.current = {
      tab,
      stationsSubTab: subTab,
      search,
      selectedAlbumId: details.album?.id ?? null,
      selectedArtistId: details.artist?.id ?? null,
      selectedPlaylistId: details.playlist?.id ?? null,
      selectedArtistName: details.artist?.name ?? "",
      selectedPlaylistName: details.playlist?.name ?? "",
    };
    save.current();
  }, [isRestored, tab, subTab, search, details]);

  useEffect(() => {
    // The app shell's <main> is what scrolls
    const scroller = root.current?.closest("main") ?? null;
    const remember = () => {
      if (view.current) scrollTop.current = scroller?.scrollTop ?? 0;
    };
    scroller?.addEventListener("scroll", remember, { passive: true });
    const write = save.current;
    return () => {
      scroller?.removeEventListener("scroll", remember);
      write();
    };
  }, []);

  // ── First load: the tab, then what was open ───────────────────────────
  const restore = useEffectEvent(async () => {
    if (hasMusic) void library.preloadStars();
    // Each step gives up when the user has moved on meanwhile
    let isCurrent = true;
    if (isLibraryTab(tab)) isCurrent = await library.loadTab(tab);
    if (hasMusic) {
      const { selectedAlbumId, selectedArtistId, selectedPlaylistId } = saved;
      if (isCurrent && selectedPlaylistId) {
        isCurrent = await library.openPlaylist({
          id: selectedPlaylistId,
          name: saved.selectedPlaylistName,
        });
      }
      if (isCurrent && selectedArtistId) {
        isCurrent = await library.openArtist({
          id: selectedArtistId,
          name: saved.selectedArtistName,
        });
      }
      if (isCurrent && selectedAlbumId) {
        await library.openAlbum({ id: selectedAlbumId });
      }
    }
    setIsRestored(true);
    if (saved.scrollY) {
      requestAnimationFrame(() => {
        const scroller = root.current?.closest("main");
        if (scroller) scroller.scrollTop = saved.scrollY;
      });
    }
  });
  const didStart = useRef(false);
  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;
    void restore();
  }, []);

  const showForced = useEffectEvent((next: RadioTab) => {
    library.closeDetails();
    if (isLibraryTab(next)) void library.loadTab(next);
  });
  useEffect(() => {
    if (forced) showForced(forced.tab);
  }, [forced]);

  const selectTab = (next: RadioTab) => {
    setTab(next);
    library.closeDetails();
    if (isLibraryTab(next)) void library.loadTab(next);
  };

  const playStation = (station: Station) => {
    const track = stationToTrack(station, t("radio.stations.fallbackGenre"));
    void playTrack(track, [track], 0);
  };

  const playRandomStation = () => {
    const pick = stations.at(Math.floor(Math.random() * stations.length));
    if (pick) playStation(pick);
    else toast.error(t("radio.toast.addStationFirst"));
  };

  const shuffleButton =
    tab === "stations" ? (
      <span title={t("radio.randomHint")}>
        <Button
          variant="secondary"
          size="sm"
          text={t("radio.random")}
          isDisabled={stations.length === 0}
          onClick={playRandomStation}
        >
          <Shuffle aria-hidden className="size-4" />
        </Button>
      </span>
    ) : hasMusic && tab !== "search" ? (
      <span title={t("radio.mixHint")}>
        <Button
          variant="secondary"
          size="sm"
          text={t("radio.mix")}
          onClick={library.playMix}
        >
          <Shuffle aria-hidden className="size-4" />
        </Button>
      </span>
    ) : null;

  const railGroup = (title: string, tabs: RadioTab[]) => (
    <Stack gap={1}>
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {tabs.map((entry) => {
        const Icon = TAB_ICONS[entry];
        return (
          <Button
            key={entry}
            size="md"
            isFullWidth
            classNameButton="justify-start"
            text={t(`radio.tabs.${entry}`)}
            isActive={tab === entry}
            aria-current={tab === entry ? "page" : undefined}
            onClick={() => {
              selectTab(entry);
            }}
          >
            <Icon aria-hidden className="size-4" />
          </Button>
        );
      })}
    </Stack>
  );

  const rowTabs = availableTabs(features);

  return (
    <div ref={root} className="flex flex-col gap-3 p-4">
      <Row gap={2} align="center">
        {hasDetail ? (
          <Button
            size="sm"
            aria-label={t("common.back")}
            onClick={library.back}
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Button>
        ) : null}
        <Stack shouldGrow>
          <Text variant="title" as="h1" isTruncated>
            {detailName || t("radio.title")}
          </Text>
        </Stack>
        {isWide && !hasDetail ? shuffleButton : null}
      </Row>

      {!isWide && !hasDetail ? (
        <Row gap={2} align="center">
          <Row shouldGrow>
            <SegmentedControl
              variant="pill"
              aria-label={t("radio.sections")}
              value={tab}
              options={rowTabs.map((entry) => ({
                value: entry,
                label: t(`radio.tabs.${entry}`),
              }))}
              onChange={selectTab}
            />
          </Row>
          {hasMusic ? (
            <Button
              size="sm"
              aria-label={t("radio.searchLibrary")}
              aria-pressed={tab === "search"}
              isActive={tab === "search"}
              onClick={() => {
                selectTab("search");
              }}
            >
              <Search aria-hidden className="size-4" />
            </Button>
          ) : null}
          {shuffleButton}
        </Row>
      ) : null}

      {tab === "search" && hasMusic && !hasDetail ? (
        <Row gap={2} align="center">
          <Stack shouldGrow>
            <Input
              type="search"
              fieldSize="md"
              aria-label={t("radio.searchLibrary")}
              placeholder={t("radio.searchPlaceholder")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              onEnter={() => {
                library.search(search);
              }}
            />
          </Stack>
          <Button
            variant="primary"
            size="md"
            text={t("common.search")}
            isLoading={library.isLoading}
            onClick={() => {
              library.search(search);
            }}
          />
        </Row>
      ) : null}

      <div
        className={
          isWide
            ? "grid grid-cols-[12rem_minmax(0,1fr)_19rem] items-start gap-4"
            : ""
        }
      >
        {isWide ? (
          <nav
            aria-label={t("radio.sections")}
            className="sticky top-20 flex flex-col gap-4"
          >
            {hasMusic
              ? railGroup(t("radio.groupMusic"), [
                  ...rowTabs.filter((entry) => entry !== "stations"),
                  "search",
                ])
              : null}
            {hasStations
              ? railGroup(t("radio.groupRadio"), ["stations"])
              : null}
          </nav>
        ) : null}

        <div className="min-w-0">
          {tab === "stations" && !hasDetail ? (
            <Stack gap={3}>
              <Row>
                <SegmentedControl
                  variant="pill"
                  aria-label={t("radio.stations.subTabs")}
                  value={subTab}
                  options={[
                    { value: "my", label: t("radio.stations.my") },
                    { value: "browse", label: t("radio.stations.browse") },
                  ]}
                  onChange={setSubTab}
                />
              </Row>
              {subTab === "my" ? (
                <MyStations
                  stations={stations}
                  onChange={saveStations}
                  onPlay={playStation}
                />
              ) : (
                <BrowseStations
                  stations={stations}
                  onAdd={(station) => {
                    // The list as it is now, after the icon lookup
                    saveStations([...currentStations(), station]);
                  }}
                />
              )}
            </Stack>
          ) : (
            <LibraryContent
              library={library}
              tab={tab === "stations" ? "albums" : tab}
            />
          )}
        </div>

        {isWide ? (
          <div className="sticky top-20">
            <NowPlayingPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function currentStations(): Station[] {
  return parseStations(settingsStores.lt.get("radioStations"));
}
