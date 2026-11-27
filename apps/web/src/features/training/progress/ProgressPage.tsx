import {
  Button,
  DatePicker,
  Dialog,
  FileInput,
  Panel,
  Pressable,
  Row,
  Sheet,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Camera, CircleCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { BODY_STATS_SAVED } from "../common/events";
import { formatDay } from "../common/format";
import { LoadFailed, Loading } from "../common/LoadState";
import { useResource } from "../common/useResource";
import { useRun } from "../common/useRun";
import {
  comparePair,
  groupByMonth,
  type ProgressPhoto,
  weightOfStats,
} from "../lib/progressPhotos";
import { type BodyStatsRow, localDay } from "../lib/statistics";
import {
  addProgressPhoto,
  deleteProgressPhoto,
  getBodyStats,
  getProgressPhotos,
} from "./api";
import { PhotoCompare } from "./PhotoCompare";
import { PhotoImage } from "./PhotoImage";
import { PhotoScrubber } from "./PhotoScrubber";
import { WeightQuickLog } from "./WeightQuickLog";

const MONTHS = 12;

async function loadTimeline(): Promise<{
  photos: ProgressPhoto[];
  stats: BodyStatsRow[];
}> {
  const from = new Date();
  from.setMonth(from.getMonth() - MONTHS);
  const [start, end] = [localDay(from), localDay()];
  const [photos, stats] = await Promise.all([
    getProgressPhotos(start, end),
    getBodyStats(start, end).catch((): BodyStatsRow[] => []),
  ]);
  return { photos, stats };
}

type Comparison = ReturnType<typeof comparePair<ProgressPhoto>>;

/** /training/progress: dated progress photos and their comparison */
export function ProgressPage() {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const run = useRun();
  const [unit] = useSetting("lt", "weightUnit");
  const timeline = useResource("progress-photos", loadTimeline);
  const [targetDate, setTargetDate] = useState(() => localDay());
  const [isUploading, setIsUploading] = useState(false);
  const [promptDate, setPromptDate] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [picked, setPicked] = useState<ProgressPhoto[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ProgressPhoto | null>(null);

  const { reload } = timeline;
  useEffect(() => {
    window.addEventListener(BODY_STATS_SAVED, reload);
    return () => {
      window.removeEventListener(BODY_STATS_SAVED, reload);
    };
  }, [reload]);

  const photos = timeline.data?.photos ?? [];
  const weights = new Map(
    (timeline.data?.stats ?? []).map((row) => [
      row.date,
      weightOfStats(row.stats),
    ]),
  );
  const weightOf = (date: string) => weights.get(date) ?? null;

  const stopPicking = () => {
    setIsPicking(false);
    setPicked([]);
  };
  const compare = (a: ProgressPhoto, b: ProgressPhoto) => {
    setComparison(comparePair(a, b));
    stopPicking();
  };
  const choose = (photo: ProgressPhoto) => {
    if (!isPicking) {
      setViewingId(photo.id);
      return;
    }
    if (picked.some((p) => p.id === photo.id)) {
      setPicked(picked.filter((p) => p.id !== photo.id));
      return;
    }
    const first = picked.at(-1);
    if (first) compare(first, photo);
    else setPicked([photo]);
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    const day = targetDate;
    setIsUploading(true);
    try {
      await addProgressPhoto(file, day);
      toast.info(t("progress.added"));
      // Ask for the missing weight while it is still easy to know.
      if (weightOf(day) === null) setPromptDate(day);
      reload();
    } catch (error) {
      toast.error(t("common.error", { message: (error as Error).message }));
    } finally {
      setIsUploading(false);
    }
  };

  const picker = isUploading ? (
    <Spinner label={t("progress.adding")} />
  ) : (
    <FileInput
      accept="image/*"
      capture="environment"
      variant="primary"
      text={t("progress.add")}
      captureText={t("progress.take")}
      placeholder={t("progress.noFile")}
      file={null}
      onChange={(file) => void upload(file)}
    />
  );

  const datePicker = (
    <DatePicker
      label={t("progress.dateForNext")}
      value={targetDate}
      maxDate={localDay()}
      format={(day) =>
        day === localDay() ? t("progress.today") : formatDay(day, i18n.language)
      }
      onChange={(day) => {
        setTargetDate(day ?? localDay());
      }}
    />
  );

  const first = photos.at(-1);
  const latest = photos.at(0);
  const monthName = (month: string) =>
    formatDay(`${month}-01`, i18n.language, {
      month: "long",
      year: "numeric",
    });
  const dayName = (day: string) =>
    formatDay(day, i18n.language, { day: "numeric", month: "short" });

  return (
    <Stack gap={4} padding={4} className="mx-auto w-full max-w-4xl">
      <Text variant="title" as="h1">
        {t("progress.title")}
      </Text>
      {timeline.error && !timeline.data ? (
        <LoadFailed error={timeline.error} onRetry={reload} />
      ) : !timeline.data ? (
        <Loading />
      ) : (
        <>
          <Row gap={3} align="end" className="flex-wrap">
            {picker}
            {datePicker}
            {photos.length >= 3 && first && latest && (
              <Button
                variant="secondary"
                text={t("progress.compareEnds")}
                onClick={() => {
                  compare(first, latest);
                }}
              />
            )}
            {photos.length >= 2 && (
              <Button
                variant={isPicking ? "primary" : "secondary"}
                aria-pressed={isPicking}
                text={isPicking ? t("common.cancel") : t("progress.compareTwo")}
                onClick={() => {
                  if (isPicking) stopPicking();
                  else setIsPicking(true);
                }}
              />
            )}
          </Row>
          {isPicking && (
            <Text tone="accent" role="status">
              {t("progress.pickHint", { count: picked.length })}
            </Text>
          )}
          {promptDate && (
            <Panel>
              <Stack gap={2}>
                <Text>
                  {t("progress.weight.prompt", { date: dayName(promptDate) })}
                </Text>
                <WeightQuickLog
                  date={promptDate}
                  onSaved={() => {
                    setPromptDate(null);
                  }}
                  onCancel={() => {
                    setPromptDate(null);
                  }}
                />
              </Stack>
            </Panel>
          )}
          {photos.length === 0 && (
            <EmptyNote
              icon={<Camera aria-hidden />}
              text={t("progress.empty")}
            />
          )}
          {groupByMonth(photos).map((group) => (
            <Stack key={group.month} gap={2}>
              <Text variant="heading" as="h2">
                {monthName(group.month)}
              </Text>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {group.photos.map((photo) => {
                  const isChosen = picked.some((p) => p.id === photo.id);
                  const weight = weightOf(photo.date);
                  const name = dayName(photo.date);
                  return (
                    <li key={photo.id} className="flex flex-col gap-1">
                      <Pressable
                        className={`relative aspect-[3/4] w-full overflow-hidden rounded-container border-2 bg-level-2 ${
                          isChosen ? "border-accent" : "border-transparent"
                        }`}
                        label={t("progress.photo", { date: name })}
                        isPressed={isPicking ? isChosen : undefined}
                        onPress={() => {
                          choose(photo);
                        }}
                      >
                        <PhotoImage
                          photo={photo}
                          alt={t("progress.photo", { date: name })}
                        />
                        {isChosen && (
                          <CircleCheck
                            aria-hidden
                            className="absolute right-2 top-2 text-accent"
                          />
                        )}
                      </Pressable>
                      <Row gap={2} justify="between" align="center">
                        <Text variant="small">
                          {weight === null
                            ? name
                            : `${name} · ${weight} ${unit}`}
                        </Text>
                        {!isPicking && (
                          <Button
                            size="sm"
                            aria-label={t("progress.delete", { date: name })}
                            onClick={() => {
                              setDeleting(photo);
                            }}
                          >
                            <Trash2 aria-hidden size={16} />
                          </Button>
                        )}
                      </Row>
                    </li>
                  );
                })}
              </ul>
            </Stack>
          ))}
        </>
      )}

      <Sheet
        isOpen={comparison !== null}
        title={t("progress.compare.title")}
        onOpenChange={(isUp) => {
          if (!isUp) setComparison(null);
        }}
      >
        {comparison && <PhotoCompare {...comparison} />}
      </Sheet>
      <Sheet
        isOpen={viewingId !== null}
        title={t("progress.scrub.title")}
        onOpenChange={(isUp) => {
          if (!isUp) setViewingId(null);
        }}
      >
        {viewingId !== null && (
          <PhotoScrubber
            photos={photos}
            startId={viewingId}
            weightOf={weightOf}
          />
        )}
      </Sheet>
      <Dialog
        open={deleting !== null}
        onOpenChange={(isUp) => {
          if (!isUp) setDeleting(null);
        }}
        variant="danger"
        title={t("progress.deleteTitle")}
        description={t("progress.deleteText")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={async () => {
          const photo = deleting;
          if (!photo) return;
          await run(async () => {
            await deleteProgressPhoto(photo.id);
            timeline.mutate((data) => ({
              ...data,
              photos: data.photos.filter((p) => p.id !== photo.id),
            }));
          }, t("progress.deleted"));
          setDeleting(null);
        }}
      />
    </Stack>
  );
}
