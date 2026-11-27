/** The radio-browser.info directory */
import {
  Button,
  Chip,
  Input,
  Pressable,
  Row,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Check, Plus, Radio, Search, Telescope, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  browsedStationId,
  existingStationUrls,
  isAlreadyAdded,
  radioBrowserSubtitle,
  radioBrowserToStation,
  type RadioBrowserStation,
  type Station,
} from "../lib/radio";
import { searchRadioBrowser, suggestStationIcon } from "./api";
import { EmptyNote } from "../common/EmptyNote";
import { PlayerArt } from "./PlayerArt";

const DEBOUNCE_MS = 350;

/** The station to save, with the best icon there is */
async function stationOf(result: RadioBrowserStation): Promise<Station> {
  const record = radioBrowserToStation(result, browsedStationId(Date.now()));
  // The station's own homepage has better icons than the directory
  if (record.homepage) {
    const iconUrl = await suggestStationIcon(record.homepage).catch(() => "");
    if (iconUrl) record.iconUrl = iconUrl;
  }
  return record;
}

export interface BrowseStationsProps {
  stations: Station[];
  /** Appends to the stations as they are by then */
  onAdd: (station: Station) => void;
}

export function BrowseStations({ stations, onAdd }: BrowseStationsProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [query, setQuery] = useState("");
  /** The results and the query they answer */
  const [found, setFound] = useState<{
    query: string;
    results: RadioBrowserStation[];
  }>({ query: "", results: [] });
  /** Being added right now (the icon lookup takes a moment) */
  const adding = useRef(new Set<string>());
  const trimmed = query.trim();
  const isSearching = trimmed !== "" && found.query !== trimmed;
  const results = trimmed ? found.results : [];
  const addedUrls = existingStationUrls(stations);

  const fail = useEffectEvent(() => {
    toast.error(t("radio.toast.browseFailed"));
  });

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchRadioBrowser(trimmed, controller.signal).then(
        (next) => {
          if (!controller.signal.aborted) {
            setFound({ query: trimmed, results: next });
          }
        },
        () => {
          if (controller.signal.aborted) return;
          fail();
          setFound({ query: trimmed, results: [] });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const add = async (result: RadioBrowserStation, key: string) => {
    if (adding.current.has(key)) return;
    adding.current.add(key);
    const record = await stationOf(result);
    onAdd(record);
    adding.current.delete(key);
    toast.info(t("radio.toast.addedNamed", { name: record.name }));
  };

  return (
    <Stack gap={2}>
      <Row gap={1} align="center">
        <Stack shouldGrow>
          <Input
            type="search"
            aria-label={t("radio.browse.label")}
            placeholder={t("radio.browse.placeholder")}
            icon={<Search className="size-4" />}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </Stack>
        {query ? (
          <Button
            size="sm"
            aria-label={t("radio.browse.clear")}
            onClick={() => {
              setQuery("");
              setFound({ query: "", results: [] });
            }}
          >
            <X aria-hidden className="size-4" />
          </Button>
        ) : null}
      </Row>
      <Text variant="caption">
        {t("radio.browse.poweredBy")}{" "}
        <a
          href="https://www.radio-browser.info"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-text underline"
        >
          radio-browser.info
        </a>
      </Text>

      {isSearching ? (
        <Row gap={2} align="center" justify="center" paddingY={4}>
          <Spinner size="sm" label={t("radio.browse.searching")} />
          <Text variant="small" tone="muted">
            {t("radio.browse.searching")}
          </Text>
        </Row>
      ) : !trimmed ? (
        <EmptyNote
          icon={<Telescope className="size-12" />}
          text={t("radio.browse.idle")}
        />
      ) : results.length === 0 ? (
        <EmptyNote text={t("radio.browse.noResults")} />
      ) : (
        <Stack gap={1}>
          {results.map((result, index) => {
            const key = `${result.url_resolved ?? result.url ?? ""}:${index}`;
            const isAdded = isAlreadyAdded(result, addedUrls);
            const name = result.name ?? "";
            return (
              <Row key={key} gap={1} align="center">
                <Pressable
                  shouldGrow
                  paddingX={2}
                  paddingY={1}
                  isDisabled={isAdded}
                  onPress={() => void add(result, key)}
                >
                  <Row gap={3} align="center">
                    <PlayerArt
                      className="size-10"
                      sources={[result.favicon || undefined]}
                      fallback={<Radio className="size-5" />}
                    />
                    <Stack shouldGrow>
                      <Text as="span" isTruncated>
                        {name}
                      </Text>
                      <Text as="span" variant="caption" isTruncated>
                        {radioBrowserSubtitle(result)}
                      </Text>
                    </Stack>
                  </Row>
                </Pressable>
                {isAdded ? (
                  <Chip
                    text={t("radio.browse.added")}
                    title={t("radio.browse.alreadyAdded")}
                    icon={<Check className="size-3" />}
                  />
                ) : (
                  <Button
                    size="sm"
                    aria-label={t("radio.browse.add", { name })}
                    onClick={() => void add(result, key)}
                  >
                    <Plus aria-hidden className="size-4" />
                  </Button>
                )}
              </Row>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
