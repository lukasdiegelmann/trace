import {
  Panel,
  Chip,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { ltAssetUrl } from "../common/assets";
import { formatDay } from "../common/format";
import { isTwoFrame, youTubeEmbedUrl, youTubeId } from "../lib/exerciseMedia";
import type { ExerciseRecord } from "../lib/exercisePr";
import type { HistoryEntry } from "../lib/workout";
import type { Exercise } from "./api";
import { historySetLabel, recordText } from "./historyLabels";
import { categoryLabel, equipmentLabel, muscleLabel } from "./labels";

export interface ExerciseInfoProps {
  exercise: Exercise;
  record?: ExerciseRecord | null;
  /** Newest first; the last ten sessions are listed */
  history?: HistoryEntry[];
}

function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation("training");
  const { video_url: videoUrl, gif_url: gif, img_url: img, name } = exercise;
  const video = youTubeId(videoUrl);
  if (!videoUrl && !gif && !img) return null;
  const frame = "size-full object-contain";
  return (
    <Stack gap={1}>
      <div className="relative aspect-video w-full overflow-hidden rounded-container bg-level-2">
        {video ? (
          <iframe
            className="size-full"
            src={youTubeEmbedUrl(video)}
            title={t("exerciseInfo.demo", { name })}
            allowFullScreen
          />
        ) : videoUrl ? (
          <video
            className={frame}
            src={ltAssetUrl(videoUrl)}
            poster={ltAssetUrl(img || gif)}
            controls
            playsInline
          />
        ) : isTwoFrame(exercise) ? (
          <>
            <img
              className={`${frame} absolute inset-0`}
              src={ltAssetUrl(img)}
              alt={t("exerciseInfo.startPosition")}
            />
            {/* The end frame blinks over the start; still without motion */}
            <img
              className={`${frame} absolute inset-0 bg-level-2 motion-safe:animate-[training-frame-swap_1.8s_step-end_infinite] motion-reduce:hidden`}
              src={ltAssetUrl(gif)}
              alt={t("exerciseInfo.endPosition")}
            />
            <style>{`@keyframes training-frame-swap { 0% { opacity: 0 } 50% { opacity: 1 } }`}</style>
          </>
        ) : (
          <img className={frame} src={ltAssetUrl(gif || img)} alt={name} />
        )}
      </div>
      {exercise.source && (
        <Text variant="caption" tone="muted">
          {t("exerciseInfo.via", { source: exercise.source })}
        </Text>
      )}
    </Stack>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" as="h3">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

/** What an exercise is: media, tags, muscles, how to, record and history */
export function ExerciseInfo({ exercise, record, history }: ExerciseInfoProps) {
  const { t, i18n } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");

  const muscles = (title: string, values: string[] | null | undefined) =>
    values?.length ? (
      <Section title={title}>
        <Row gap={2} className="flex-wrap">
          {values.map((muscle) => (
            <Chip key={muscle} text={muscleLabel(t, muscle)} />
          ))}
        </Row>
      </Section>
    ) : null;

  return (
    <Stack gap={4}>
      <ExerciseMedia exercise={exercise} />
      <Row gap={2} className="flex-wrap">
        {exercise.category && (
          <Chip tone="accent" text={categoryLabel(t, exercise.category)} />
        )}
        {(exercise.equipment ?? []).map((value) => (
          <Chip key={value} tone="muted" text={equipmentLabel(t, value)} />
        ))}
      </Row>
      {muscles(t("exerciseInfo.primaryMuscles"), exercise.primary_muscles)}
      {muscles(t("exerciseInfo.secondaryMuscles"), exercise.secondary_muscles)}
      {exercise.instructions && (
        <Section title={t("exerciseInfo.howTo")}>
          <Text shouldKeepLineBreaks>{exercise.instructions}</Text>
        </Section>
      )}
      {exercise.tips && (
        <Section title={t("exerciseInfo.tips")}>
          <Text shouldKeepLineBreaks>{exercise.tips}</Text>
        </Section>
      )}
      {record && (
        <Panel>
          <Row gap={3} align="center">
            <Trophy aria-hidden className="text-accent" />
            <Stack gap={0}>
              <Text variant="caption" tone="muted">
                {t("exerciseInfo.record")}
              </Text>
              <Text variant="heading">{recordText(record, unit)}</Text>
              <Text variant="caption" tone="muted">
                {formatDay(record.date, i18n.language)}
              </Text>
            </Stack>
          </Row>
        </Panel>
      )}
      {history && history.length > 0 && (
        <Section title={t("exerciseInfo.history")}>
          <Stack gap={2}>
            {history.slice(0, 10).map((entry, index) => (
              <Row
                key={`${entry.date}-${index}`}
                gap={3}
                justify="between"
                className="flex-wrap"
              >
                <Text variant="small" tone="muted">
                  {formatDay(entry.date, i18n.language)}
                </Text>
                <Text variant="small">
                  {(entry.sets ?? [])
                    .filter((set) => set.completed)
                    .map((set) =>
                      historySetLabel(set, entry, exercise.load_type),
                    )
                    .join(" | ")}
                </Text>
              </Row>
            ))}
          </Stack>
        </Section>
      )}
    </Stack>
  );
}
