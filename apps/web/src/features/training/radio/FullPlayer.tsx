/** The large player in a sheet, after components/radio/FullPlayer.svelte */
import {
  Button,
  Pressable,
  Row,
  Sheet,
  Slider,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "../common/assets";
import { fmtTime } from "../lib/radio";
import {
  cycleRepeat,
  next,
  playQueueIndex,
  prev,
  removeFromQueue,
  seek,
  setQueueShown,
  setVolume,
  togglePlay,
  toggleShuffle,
} from "./player";
import { PlayerArt } from "./PlayerArt";
import { tintStyle } from "./tintStyle";
import { useDominantColor } from "./useDominantColor";
import { usePlayer } from "./usePlayer";

const SEEK_STEPS = 1000;

/** Its own component, so only it renders on every progress tick */
function SeekBar() {
  const { t } = useTranslation("training");
  const progress = usePlayer("progress");
  const currentTime = usePlayer("currentTime");
  const duration = usePlayer("duration");
  return (
    <Stack gap={1} fill="width">
      <Slider
        aria-label={t("player.seek")}
        max={SEEK_STEPS}
        value={Math.round(progress * SEEK_STEPS)}
        isDisabled={duration <= 0}
        formatValue={(value) => fmtTime((value / SEEK_STEPS) * duration)}
        onChange={(value) => {
          seek(value / SEEK_STEPS);
        }}
      />
      <Row justify="between">
        <Text variant="caption">{fmtTime(currentTime)}</Text>
        <Text variant="caption">{fmtTime(duration)}</Text>
      </Row>
    </Stack>
  );
}

function Queue() {
  const { t } = useTranslation("training");
  const queue = usePlayer("queue");
  const queueIndex = usePlayer("queueIndex");
  return (
    <ol className="m-0 flex max-h-60 w-full list-none flex-col gap-1 overflow-y-auto p-0">
      {queue.map((track, index) => {
        const isCurrent = index === queueIndex;
        return (
          <li
            key={`${track.id}:${index}`}
            className={`flex items-center gap-1 rounded-control ${isCurrent ? "bg-level-2" : ""}`}
            aria-current={isCurrent || undefined}
          >
            <Pressable
              shouldGrow
              paddingX={1}
              paddingY={1}
              label={t("player.playItem", { title: track.title })}
              onPress={() => {
                playQueueIndex(index);
              }}
            >
              <Row gap={2} align="center">
                <span className="flex w-7 shrink-0 justify-center">
                  {isCurrent ? (
                    <AudioLines aria-hidden className="size-4 text-accent" />
                  ) : (
                    <Text as="span" variant="caption">
                      {index + 1}
                    </Text>
                  )}
                </span>
                <Stack shouldGrow>
                  <Text as="span" variant="small" isTruncated>
                    {track.title}
                  </Text>
                  <Text as="span" variant="caption" isTruncated>
                    {track.artist}
                  </Text>
                </Stack>
              </Row>
            </Pressable>
            <Button
              size="sm"
              aria-label={t("player.removeItem", { title: track.title })}
              onClick={() => {
                removeFromQueue(index);
              }}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

export interface FullPlayerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function FullPlayer({ isOpen, onOpenChange }: FullPlayerProps) {
  const { t } = useTranslation("training");
  const track = usePlayer("currentTrack");
  const isPlaying = usePlayer("isPlaying");
  const isBuffering = usePlayer("isBuffering");
  const isShuffle = usePlayer("isShuffle");
  const repeat = usePlayer("repeat");
  const volume = usePlayer("volume");
  const nowPlaying = usePlayer("streamNowPlaying");
  const streamArtwork = usePlayer("streamArtwork");
  const queueLength = usePlayer("queue").length;
  const queueIndex = usePlayer("queueIndex");
  const isQueueShown = usePlayer("isQueueShown");
  const color = useDominantColor(
    isOpen ? ltAssetUrl(streamArtwork || track?.coverUrl) : undefined,
  );
  if (!track) return null;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("player.nowPlaying")}
      snapPoints={[0.92]}
      className="mx-auto max-w-105"
    >
      <div className="rounded-container" style={tintStyle(color)}>
        <Stack gap={4} align="center" padding={2}>
          <div className="relative w-[min(17.5rem,70vw)]">
            <PlayerArt
              className={`aspect-square w-full shadow-md ${isPlaying && !isBuffering ? "ring-2 ring-accent/40" : ""}`}
              sources={[
                streamArtwork || undefined,
                track.coverUrl || undefined,
              ]}
              fallback={<Music className="size-16" />}
            />
            {isBuffering ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-control bg-level-0/70">
                <Spinner size="lg" label={t("player.loading")} />
                <Text variant="caption">{t("player.loading")}</Text>
              </div>
            ) : null}
          </div>

          <Stack gap={1} fill="width">
            <Text variant="heading" align="center" isTruncated>
              {track.title}
            </Text>
            <Text variant="small" tone="muted" align="center">
              {nowPlaying ? `♪ ${nowPlaying}` : track.artist}
            </Text>
          </Stack>

          <SeekBar />

          <Row gap={3} align="center" justify="center">
            <Button
              size="md"
              aria-label={t("player.shuffle")}
              aria-pressed={isShuffle}
              isActive={isShuffle}
              onClick={toggleShuffle}
            >
              <Shuffle
                aria-hidden
                className={`size-5 ${isShuffle ? "text-accent" : ""}`}
              />
            </Button>
            <Button size="md" aria-label={t("player.previous")} onClick={prev}>
              <SkipBack aria-hidden className="size-7" />
            </Button>
            <Button
              size="lg"
              variant="primary"
              aria-label={t(isPlaying ? "player.pause" : "player.play")}
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause aria-hidden className="size-8" />
              ) : (
                <Play aria-hidden className="size-8" />
              )}
            </Button>
            <Button
              size="md"
              aria-label={t("player.next")}
              onClick={() => void next()}
            >
              <SkipForward aria-hidden className="size-7" />
            </Button>
            <Button
              size="md"
              aria-label={t(`player.repeat.${repeat}`)}
              isActive={repeat !== "off"}
              onClick={cycleRepeat}
            >
              <RepeatIcon
                aria-hidden
                className={`size-5 ${repeat !== "off" ? "text-accent" : ""}`}
              />
            </Button>
          </Row>

          <Row gap={2} align="center" fill="width" justify="center">
            <Volume2 aria-hidden className="size-4 shrink-0 text-muted" />
            <Slider
              className="w-full max-w-52"
              aria-label={t("player.volume")}
              max={1}
              step={0.05}
              value={volume}
              formatValue={(value) => `${Math.round(value * 100)}%`}
              onChange={setVolume}
            />
          </Row>

          {queueLength > 1 ? (
            <Button
              size="sm"
              text={t("player.queue", {
                current: queueIndex + 1,
                total: queueLength,
              })}
              aria-expanded={isQueueShown}
              onClick={() => {
                setQueueShown(!isQueueShown);
              }}
            >
              {isQueueShown ? (
                <ChevronUp aria-hidden className="size-4" />
              ) : (
                <ChevronDown aria-hidden className="size-4" />
              )}
            </Button>
          ) : null}
          {isQueueShown && queueLength > 0 ? <Queue /> : null}
        </Stack>
      </div>
    </Sheet>
  );
}
