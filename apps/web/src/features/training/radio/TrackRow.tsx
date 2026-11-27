import {
  Button,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { AudioLines, Star } from "lucide-react";
import { useRef, type ReactNode, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { Track } from "../lib/radio";
import { usePlayer } from "./usePlayer";

export interface MenuAt {
  track: Track;
  x: number;
  y: number;
}

export interface TrackRowProps {
  track: Track;
  /** Cover or track number; the playing track shows moving bars instead */
  leading: ReactNode;
  meta: string;
  onPlay: () => void;
  /** Right-click, long press or the menu key */
  onMenu: (at: MenuAt) => void;
  /** Left out where the provider has no favorites */
  star?: { isStarred: boolean; onToggle: () => void };
}

export function TrackRow({
  track,
  leading,
  meta,
  onPlay,
  onMenu,
  star,
}: TrackRowProps) {
  const { t } = useTranslation("training");
  const currentTrack = usePlayer("currentTrack");
  const isCurrent = currentTrack?.id === track.id;
  const lastPointer = useRef({ x: 0, y: 0 });

  const openMenu = (event: MouseEvent) => {
    event.preventDefault();
    let { clientX: x, clientY: y } = event;
    // Some browsers report (0, 0) for a long press
    if (!x && !y) ({ x, y } = lastPointer.current);
    onMenu({ track, x, y });
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-control ${isCurrent ? "bg-level-2" : ""}`}
      onContextMenu={openMenu}
      onPointerDown={(event) => {
        lastPointer.current = { x: event.clientX, y: event.clientY };
      }}
    >
      <Pressable shouldGrow onPress={onPlay} paddingX={2} paddingY={1}>
        <Row gap={3} align="center">
          <div className="flex w-11 shrink-0 justify-center">
            {isCurrent ? (
              <span
                role="img"
                aria-label={t("radio.isPlaying")}
                className="flex size-11 items-center justify-center text-accent"
              >
                <AudioLines
                  aria-hidden
                  className="size-5 animate-pulse motion-reduce:animate-none"
                />
              </span>
            ) : (
              leading
            )}
          </div>
          <Stack shouldGrow>
            <Text as="span" isTruncated>
              {track.title}
            </Text>
            <Text as="span" variant="caption" isTruncated>
              {meta}
            </Text>
          </Stack>
        </Row>
      </Pressable>
      {star ? <StarButton name={track.title} {...star} /> : null}
    </div>
  );
}

export interface StarButtonProps {
  name: string;
  isStarred: boolean;
  onToggle: () => void;
}

export function StarButton({ name, isStarred, onToggle }: StarButtonProps) {
  const { t } = useTranslation("training");
  return (
    <Button
      size="sm"
      aria-label={t(isStarred ? "radio.unstar" : "radio.star", { name })}
      aria-pressed={isStarred}
      onClick={onToggle}
    >
      <Star
        aria-hidden
        className={`size-4 ${isStarred ? "fill-current text-accent" : "text-muted"}`}
      />
    </Button>
  );
}
