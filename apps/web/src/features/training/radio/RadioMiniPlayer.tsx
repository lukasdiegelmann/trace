/**
 * The player bar below every page, with the full player behind it. The app
 * shell mounts it once; it shows nothing while nothing is loaded.
 */
import {
  Box,
  Button,
  Pressable,
  ProgressBar,
  Row,
  Slider,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Music, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { FullPlayer } from "./FullPlayer";
import { next, prev, setVolume, stop, togglePlay } from "./player";
import { PlayerArt } from "./PlayerArt";
import { useIsRadioWide } from "./useIsRadioWide";
import { usePlayer } from "./usePlayer";

const RADIO_PATH = "/training/radio";

function Progress() {
  const { t } = useTranslation("training");
  const progress = usePlayer("progress");
  return (
    <ProgressBar
      value={progress}
      label={t("player.progress")}
      className="absolute inset-x-0 top-0"
    />
  );
}

export function RadioMiniPlayer() {
  const { t } = useTranslation("training");
  const { pathname } = useLocation();
  const isWide = useIsRadioWide();
  const track = usePlayer("currentTrack");
  const isPlaying = usePlayer("isPlaying");
  const isBuffering = usePlayer("isBuffering");
  const volume = usePlayer("volume");
  const nowPlaying = usePlayer("streamNowPlaying");
  const streamArtwork = usePlayer("streamArtwork");
  /** The page the full player was opened on; leaving it closes the sheet */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  if (openedOn !== null && (openedOn !== pathname || !track)) {
    setOpenedOn(null);
  }

  // On the wide Radio page the "now playing" column takes this one's place
  const isReplaced = isWide && pathname.replace(/\/+$/, "") === RADIO_PATH;
  if (!track || isReplaced) return null;

  return (
    <Box
      as="section"
      aria-label={t("player.label")}
      position="relative"
      border="top"
      canShrink={false}
      className="bg-level-1"
    >
      <Progress />
      <Row gap={1} align="center" paddingX={3} paddingY={2}>
        <Pressable
          shouldGrow
          label={t("player.open", { title: track.title })}
          onPress={() => {
            setOpenedOn(pathname);
          }}
        >
          <Row gap={3} align="center">
            <div className="relative">
              <PlayerArt
                className={`size-10 ${isPlaying && !isBuffering ? "ring-2 ring-accent/40" : ""}`}
                sources={[
                  streamArtwork || undefined,
                  track.coverUrl || undefined,
                ]}
                fallback={<Music className="size-5" />}
              />
              {isBuffering ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-control bg-level-0/70">
                  <Spinner size="sm" label={t("player.loading")} />
                </div>
              ) : null}
            </div>
            <Stack shouldGrow>
              <Text as="span" variant="small" isTruncated>
                {track.title}
              </Text>
              <Text as="span" variant="caption" isTruncated>
                {nowPlaying ? `♪ ${nowPlaying}` : track.artist}
              </Text>
            </Stack>
          </Row>
        </Pressable>
        <Button size="sm" aria-label={t("player.previous")} onClick={prev}>
          <SkipBack aria-hidden className="size-5" />
        </Button>
        <Button
          size="md"
          aria-label={t(isPlaying ? "player.pause" : "player.play")}
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause aria-hidden className="size-6 text-accent" />
          ) : (
            <Play aria-hidden className="size-6 text-accent" />
          )}
        </Button>
        <Button
          size="sm"
          aria-label={t("player.next")}
          onClick={() => void next()}
        >
          <SkipForward aria-hidden className="size-5" />
        </Button>
        <div className="w-20 shrink-0 max-[30rem]:hidden">
          <Slider
            aria-label={t("player.volume")}
            max={1}
            step={0.05}
            value={volume}
            onChange={setVolume}
          />
        </div>
        <Button size="sm" aria-label={t("player.stop")} onClick={stop}>
          <X aria-hidden className="size-4" />
        </Button>
      </Row>
      <FullPlayer
        isOpen={openedOn !== null}
        onOpenChange={(isOpen) => {
          setOpenedOn(isOpen ? pathname : null);
        }}
      />
    </Box>
  );
}
