/** The right column of the wide Radio page: what plays and what comes next */
import {
  Box,
  Button,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  Headphones,
  Music,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "../common/assets";
import { EmptyNote } from "../common/EmptyNote";
import {
  next,
  playQueueIndex,
  prev,
  removeFromQueue,
  togglePlay,
} from "./player";
import { PlayerArt } from "./PlayerArt";
import { tintStyle } from "./tintStyle";
import { useDominantColor } from "./useDominantColor";
import { usePlayer } from "./usePlayer";

export function NowPlayingPanel() {
  const { t } = useTranslation("training");
  const track = usePlayer("currentTrack");
  const isPlaying = usePlayer("isPlaying");
  const nowPlaying = usePlayer("streamNowPlaying");
  const streamArtwork = usePlayer("streamArtwork");
  const queue = usePlayer("queue");
  const queueIndex = usePlayer("queueIndex");
  const color = useDominantColor(ltAssetUrl(streamArtwork || track?.coverUrl));

  if (!track) {
    return (
      <Box as="aside" aria-label={t("radio.panel.label")}>
        <EmptyNote
          icon={<Headphones className="size-10" />}
          title={t("radio.panel.nothing")}
          text={t("radio.panel.nothingText")}
        />
      </Box>
    );
  }

  const first = Math.max(0, queueIndex) + 1;
  const upcoming = queue.slice(first);

  return (
    <Box as="aside" aria-label={t("radio.panel.label")} radius="lg" isClipped>
      <div className="p-3" style={tintStyle(color)}>
        <Stack gap={3}>
          <PlayerArt
            className="aspect-square w-full"
            sources={[streamArtwork || undefined, track.coverUrl || undefined]}
            fallback={<Radio className="size-12" />}
          />
          <Stack gap={1}>
            <Text align="center" isTruncated title={track.title}>
              {nowPlaying || track.title || t("player.nowPlaying")}
            </Text>
            <Text align="center" variant="caption" isTruncated>
              {nowPlaying ? track.title : track.artist}
            </Text>
          </Stack>
          <Row gap={3} justify="center" align="center">
            <Button size="md" aria-label={t("player.previous")} onClick={prev}>
              <SkipBack aria-hidden className="size-5" />
            </Button>
            <Button
              size="lg"
              variant="primary"
              aria-label={t(isPlaying ? "player.pause" : "player.play")}
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause aria-hidden className="size-6" />
              ) : (
                <Play aria-hidden className="size-6" />
              )}
            </Button>
            <Button
              size="md"
              aria-label={t("player.next")}
              onClick={() => void next()}
            >
              <SkipForward aria-hidden className="size-5" />
            </Button>
          </Row>

          <Row gap={2} align="center">
            <Text variant="label" as="h2">
              {t("radio.panel.upNext")}
            </Text>
            {upcoming.length > 0 ? (
              <Text variant="caption">{upcoming.length}</Text>
            ) : null}
          </Row>
          {upcoming.length === 0 ? (
            <Text variant="caption">{t("radio.panel.queueEmpty")}</Text>
          ) : (
            <ol className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0">
              {upcoming.map((entry, offset) => (
                <li
                  key={`${entry.id}:${first + offset}`}
                  className="flex items-center gap-1"
                >
                  <Pressable
                    shouldGrow
                    paddingY={1}
                    label={t("radio.panel.playNow", { title: entry.title })}
                    onPress={() => {
                      playQueueIndex(first + offset);
                    }}
                  >
                    <Row gap={2} align="center">
                      <PlayerArt
                        className="size-8"
                        sources={[entry.coverUrl || undefined]}
                        fallback={<Music className="size-3.5" />}
                      />
                      <Stack shouldGrow>
                        <Text as="span" variant="small" isTruncated>
                          {entry.title}
                        </Text>
                        <Text as="span" variant="caption" isTruncated>
                          {entry.artist}
                        </Text>
                      </Stack>
                    </Row>
                  </Pressable>
                  <Button
                    size="sm"
                    aria-label={t("player.removeItem", { title: entry.title })}
                    onClick={() => {
                      removeFromQueue(first + offset);
                    }}
                  >
                    <X aria-hidden className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </Stack>
      </div>
    </Box>
  );
}
