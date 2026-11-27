import {
  Button,
  Dialog,
  Panel,
  Pressable,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeft,
  CircleAlert,
  CirclePlus,
  Dumbbell,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";
import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { ltAssetUrl } from "../common/assets";
import { downloadFile } from "../common/download";
import { formatDay } from "../common/format";
import { LineChart } from "../common/LineChart";
import { Loading } from "../common/LoadState";
import { useResource } from "../common/useResource";
import { exerciseRecord, topSetPoints } from "../lib/exercisePr";
import { buildExerciseShare } from "../lib/exerciseShare";
import { findSimilarExercises } from "../lib/exerciseSimilarity";
import { fmtSetDuration, type HistoryEntry } from "../lib/workout";
import {
  canChangeExercise,
  deleteExercise,
  type Exercise,
  getExercise,
  getExerciseHistory,
  getExercises,
} from "./api";
import { ExerciseEditor } from "./ExerciseEditor";
import { ExerciseInfo } from "./ExerciseInfo";
import { equipmentLabel } from "./labels";

interface Detail {
  exercise: Exercise;
  history: HistoryEntry[];
}

async function loadDetail(id: string): Promise<Detail> {
  const exercise = await getExercise(id);
  // The exercise still shows when its history doesn't load.
  const history = await getExerciseHistory(id).catch(() => []);
  return { exercise, history };
}

/** /training/exercises/:id */
export function ExerciseDetailPage() {
  const { id = "" } = useParams();
  return <ExerciseDetail key={id} id={id} />;
}

function ExerciseDetail({ id }: { id: string }) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions } = useAuth();
  const userId =
    sessions?.lt.state === "signed-in" ? sessions.lt.user.id : undefined;
  const detail = useResource(`exercise-${id}`, () => loadDetail(id));
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const back = () => {
    // "default" is the first entry: there is nothing to go back to.
    if (location.key === "default") void navigate("/training/exercises");
    else void navigate(-1);
  };

  const exercise = detail.data?.exercise;
  const history = detail.data?.history ?? [];
  const canChange = exercise ? canChangeExercise(exercise, userId) : false;

  const share = async () => {
    if (!exercise) return;
    const { filename, json } = buildExerciseShare(exercise);
    try {
      await downloadFile(filename, json, "application/json");
    } catch (error) {
      toast.error(t("common.error", { message: (error as Error).message }));
    }
  };

  const remove = async () => {
    if (!exercise) return;
    try {
      await deleteExercise(exercise.id);
      toast.info(t("exerciseDetail.deleted"));
      void navigate("/training/exercises", { replace: true });
    } catch (error) {
      toast.error(t("common.error", { message: (error as Error).message }));
    }
    setIsDeleting(false);
  };

  return (
    <Stack gap={4} padding={4} className="mx-auto w-full max-w-3xl">
      <Row gap={2} align="center">
        <Button aria-label={t("common.back")} onClick={back}>
          <ArrowLeft aria-hidden size={20} />
        </Button>
        <div className="min-w-0 flex-1">
          <Text variant="title" as="h1">
            {exercise?.name ?? t("exerciseDetail.title")}
          </Text>
        </div>
        {exercise && (
          <Button
            aria-label={t("exerciseDetail.share")}
            onClick={() => void share()}
          >
            <Share2 aria-hidden size={18} />
          </Button>
        )}
        {canChange && (
          <>
            <Button
              aria-label={t("common.edit")}
              onClick={() => {
                setIsEditing(true);
              }}
            >
              <Pencil aria-hidden size={18} />
            </Button>
            <Button
              variant="danger"
              aria-label={t("common.delete")}
              onClick={() => {
                setIsDeleting(true);
              }}
            >
              <Trash2 aria-hidden size={18} />
            </Button>
          </>
        )}
      </Row>

      {!exercise ? (
        detail.error ? (
          <Stack gap={2} align="center">
            <div role="alert">
              <EmptyNote
                icon={<CircleAlert aria-hidden />}
                text={t("exerciseDetail.loadFailed", {
                  message: detail.error.message,
                })}
                action={{ text: t("common.retry"), onClick: detail.reload }}
              />
            </div>
            <Button
              variant="secondary"
              text={t("exerciseDetail.backToList")}
              onClick={() => void navigate("/training/exercises")}
            />
          </Stack>
        ) : (
          <Loading label={t("exerciseDetail.loading")} />
        )
      ) : (
        <>
          <Button
            variant="primary"
            isFullWidth
            text={t("exerciseDetail.logToday")}
            onClick={() =>
              void navigate(`/training?addExercise=${exercise.id}`)
            }
          >
            <CirclePlus aria-hidden size={18} />
          </Button>
          <ExerciseInfo
            exercise={exercise}
            record={exerciseRecord(history)}
            history={history}
          />
          <ProgressCard history={history} />
          <SimilarExercises exercise={exercise} />
          <ExerciseEditor
            isOpen={isEditing}
            exercise={exercise}
            onClose={() => {
              setIsEditing(false);
            }}
            onSaved={detail.reload}
          />
          <Dialog
            open={isDeleting}
            onOpenChange={setIsDeleting}
            variant="danger"
            title={t("exerciseDetail.deleteTitle", { name: exercise.name })}
            description={t("exerciseDetail.deleteText")}
            confirmText={t("common.delete")}
            cancelText={t("common.cancel")}
            onConfirm={remove}
          />
        </>
      )}
    </Stack>
  );
}

function ProgressCard({ history }: { history: HistoryEntry[] }) {
  const { t, i18n } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");
  const points = topSetPoints(history);
  const first = points.at(0);
  const last = points.at(-1);
  if (points.length < 2 || !first || !last) return null;
  const isTimed = exerciseRecord(history)?.isTimed ?? false;
  const format = (value: number) =>
    isTimed ? fmtSetDuration(value) : `${value} ${unit}`;
  const title = isTimed
    ? t("exerciseDetail.longestHoldChart")
    : t("exerciseDetail.topSetChart");
  // The scale spans the sessions' values, so progress is visible.
  const values = points.map((point) => point.value);
  const padding = Math.max(1, (Math.max(...values) - Math.min(...values)) / 10);
  const label = (point: { date: string; value: number }) =>
    `${formatDay(point.date, i18n.language)} · ${format(point.value)}`;
  return (
    <Panel>
      <Stack gap={2}>
        <Row justify="between" align="baseline" gap={2}>
          <Text variant="label" as="h3">
            {title}
          </Text>
          <Text variant="caption" tone="muted">
            {t("exerciseDetail.sessions", { count: points.length })}
          </Text>
        </Row>
        <LineChart
          ariaLabel={title}
          lines={[
            {
              label: title,
              points: points.map((point, x) => ({ x, value: point.value })),
              min: Math.min(...values) - padding,
              max: Math.max(...values) + padding,
              format,
            },
          ]}
          from={0}
          until={points.length - 1}
          start={label(first)}
          end={label(last)}
        />
      </Stack>
    </Panel>
  );
}

function SimilarExercises({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const hasMuscles = (exercise.primary_muscles?.length ?? 0) > 0;
  const similar = useResource(`similar-${exercise.id}`, async () =>
    hasMuscles
      ? findSimilarExercises(exercise, await getExercises().catch(() => []))
      : [],
  );
  if (!similar.data?.length) return null;
  return (
    <Stack gap={2}>
      <Text variant="heading" as="h2">
        {t("exerciseDetail.similar")}
      </Text>
      <Text variant="small" tone="muted">
        {t("exerciseDetail.similarText")}
      </Text>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {similar.data.map((other) => {
          const image = other.gif_url || other.img_url;
          return (
            <li key={other.id}>
              <Pressable
                className="flex size-full flex-col gap-1 rounded-container border border-border bg-level-1 p-2 text-left"
                label={other.name}
                onPress={() => void navigate(`/training/exercises/${other.id}`)}
              >
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-level-2">
                  {image ? (
                    <img
                      className="size-full object-cover"
                      src={ltAssetUrl(image)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <Dumbbell aria-hidden className="text-muted" />
                  )}
                </div>
                <Text variant="small">{other.name}</Text>
                <Text variant="caption" tone="muted">
                  {(other.equipment ?? [])
                    .slice(0, 2)
                    .map((value) => equipmentLabel(t, value))
                    .join(", ")}
                </Text>
              </Pressable>
            </li>
          );
        })}
      </ul>
    </Stack>
  );
}
