import {
  Button,
  Dot,
  Row,
  Slider,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Pause, Play } from "lucide-react";
import { type PointerEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { formatDay } from "../common/format";
import {
  axisPositions,
  daysSinceFirst,
  nearestIndex,
  oldestFirst,
  photoSrc,
  type ProgressPhoto,
  weightDelta,
} from "../lib/progressPhotos";
import { PhotoImage } from "./PhotoImage";
import { WeightQuickLog } from "./WeightQuickLog";

const PLAY_MS = 450;
const PRELOAD = 3;

export interface PhotoScrubberProps {
  photos: ProgressPhoto[];
  startId: number;
  weightOf: (date: string) => number | null;
}

/** The whole record, one photo at a time over a true date axis */
export function PhotoScrubber({
  photos,
  startId,
  weightOf,
}: PhotoScrubberProps) {
  const { t, i18n } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");
  const ordered = oldestFirst(photos);
  const [index, setIndex] = useState(() => {
    const found = ordered.findIndex((p) => p.id === startId);
    return found >= 0 ? found : ordered.length - 1;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [loggingDate, setLoggingDate] = useState<string | null>(null);

  const last = ordered.length - 1;
  const safeIndex = Math.min(Math.max(index, 0), last);
  const current = ordered.at(safeIndex);
  const positions = axisPositions(ordered);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setIndex((value) => {
        if (value >= last - 1) setIsPlaying(false);
        return Math.min(value + 1, last);
      });
    }, PLAY_MS);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, last]);

  // Warm the neighbours and both ends, so scrubbing doesn't stutter.
  const preload = [
    ...ordered.slice(Math.max(0, safeIndex - PRELOAD), safeIndex + PRELOAD + 1),
    ...ordered.slice(0, 1),
    ...ordered.slice(-1),
  ]
    .map(photoSrc)
    .join("\n");
  useEffect(() => {
    for (const src of new Set(preload.split("\n"))) {
      if (src) new Image().src = src;
    }
  }, [preload]);

  if (!current) return null;
  const show = (next: number) => {
    setIsPlaying(false);
    setIndex(next);
  };
  const followAxis = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    show(
      nearestIndex(positions, ((event.clientX - box.left) / box.width) * 100),
    );
  };

  const weight = weightOf(current.date);
  const delta = weightDelta(ordered, safeIndex, weightOf);
  const day = daysSinceFirst(ordered, safeIndex);
  const date = formatDay(current.date, i18n.language);

  return (
    <Stack gap={3} className="mx-auto w-full max-w-md">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-container bg-level-2">
        <PhotoImage photo={current} alt={date} isEager />
      </div>
      <Stack gap={1}>
        <Row gap={3} align="center" className="flex-wrap">
          <Text variant="heading">{date}</Text>
          {weight !== null && (
            <Text>
              {weight} {unit}
            </Text>
          )}
          {day !== null && (
            <Text tone="muted">{t("progress.scrub.day", { day })}</Text>
          )}
        </Row>
        {delta && (
          <Text variant="small" tone="muted">
            {t("progress.scrub.since", {
              delta: `${delta.delta > 0 ? "+" : ""}${delta.delta}`,
              unit,
              date: formatDay(delta.since, i18n.language),
            })}
          </Text>
        )}
        {weight === null &&
          // Moving to another photo leaves the editor behind.
          (loggingDate === current.date ? (
            <WeightQuickLog
              date={current.date}
              onSaved={() => {
                setLoggingDate(null);
              }}
              onCancel={() => {
                setLoggingDate(null);
              }}
            />
          ) : (
            <Row>
              <Button
                size="sm"
                variant="secondary"
                text={t("progress.weight.add")}
                onClick={() => {
                  setIsPlaying(false);
                  setLoggingDate(current.date);
                }}
              />
            </Row>
          ))}
      </Stack>
      <Row gap={3} align="center">
        <Button
          variant="secondary"
          aria-label={
            isPlaying ? t("progress.scrub.pause") : t("progress.scrub.play")
          }
          isDisabled={ordered.length < 2}
          onClick={() => {
            if (!isPlaying && safeIndex >= last) setIndex(0);
            setIsPlaying(!isPlaying);
          }}
        >
          {isPlaying ? (
            <Pause aria-hidden size={18} />
          ) : (
            <Play aria-hidden size={18} />
          )}
        </Button>
        <Stack gap={2} className="min-w-0 flex-1">
          {/* A mark per photo at its date, so gaps in the record show */}
          <div
            aria-hidden
            className="relative h-5 cursor-pointer touch-none"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              followAxis(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                followAxis(event);
              }
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            {positions.map((position, at) => (
              <span
                key={ordered[at]?.id}
                className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${position}%` }}
              >
                <Dot
                  size={at === safeIndex ? 12 : 6}
                  tone={at === safeIndex ? "accent" : "muted"}
                />
              </span>
            ))}
          </div>
          <Slider
            aria-label={t("progress.scrub.handle")}
            min={0}
            max={Math.max(last, 1)}
            value={safeIndex}
            isDisabled={ordered.length < 2}
            onChange={show}
            formatValue={(value) =>
              formatDay(ordered[value]?.date ?? "", i18n.language)
            }
          />
        </Stack>
      </Row>
      <Row justify="between" gap={2}>
        <Text variant="caption" tone="muted">
          {formatDay(ordered[0]?.date ?? "", i18n.language)}
        </Text>
        <Text variant="caption" tone="muted">
          {formatDay(ordered[last]?.date ?? "", i18n.language)}
        </Text>
      </Row>
    </Stack>
  );
}
