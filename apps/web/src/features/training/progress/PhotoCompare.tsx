import { Row, Slider, Stack, Text } from "@monocircuit/monolithium/components";
import { type PointerEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDay } from "../common/format";
import type { ProgressPhoto } from "../lib/progressPhotos";
import { PhotoImage } from "./PhotoImage";

export interface PhotoCompareProps {
  before: ProgressPhoto;
  after: ProgressPhoto;
}

/**
 * Two photos on top of each other: dragging the divider wipes between them,
 * both at full size.
 */
// TODO(monolithium): an image comparison slider
export function PhotoCompare({ before, after }: PhotoCompareProps) {
  const { t, i18n } = useTranslation("training");
  const [percent, setPercent] = useState(50);

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const next = ((event.clientX - box.left) / box.width) * 100;
    setPercent(Math.round(Math.min(100, Math.max(0, next))));
  };

  return (
    <Stack gap={3} className="mx-auto w-full max-w-md">
      <div
        className="relative aspect-[3/4] w-full cursor-ew-resize touch-none overflow-hidden rounded-container bg-level-2"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          follow(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            follow(event);
          }
        }}
      >
        <div className="absolute inset-0">
          <PhotoImage photo={after} alt={t("progress.compare.after")} isEager />
        </div>
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        >
          <PhotoImage
            photo={before}
            alt={t("progress.compare.before")}
            isEager
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent"
          style={{ left: `${percent}%` }}
        />
      </div>
      <Slider
        aria-label={t("progress.compare.handle")}
        min={0}
        max={100}
        step={2}
        value={percent}
        onChange={setPercent}
        formatValue={(value) => `${value}%`}
      />
      <Row justify="between" gap={2}>
        <Text variant="small">{formatDay(before.date, i18n.language)}</Text>
        <Text variant="small">{formatDay(after.date, i18n.language)}</Text>
      </Row>
    </Stack>
  );
}
