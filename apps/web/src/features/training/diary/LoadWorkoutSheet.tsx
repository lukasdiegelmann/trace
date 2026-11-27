import {
  Button,
  Chip,
  EmptyState,
  Pressable,
  Row,
  Sheet,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { ChevronLeft, ChevronRight, Info, Link2, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { templateTarget } from "../lib/templateLoad";
import { programApi, type Program, type Template } from "./api";

export interface TemplateChoice {
  template: Template;
  program: Program;
}

export interface LoadWorkoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  unit: string;
  onLoad: (choice: TemplateChoice) => void;
}

export function LoadWorkoutSheet(props: LoadWorkoutSheetProps) {
  if (!props.isOpen) return null;
  return <LoadWorkoutSheetContent {...props} />;
}

/** Pick a workout of a program, with a preview and the plan week */
function LoadWorkoutSheetContent({
  isOpen,
  onClose,
  unit,
  onLoad,
}: LoadWorkoutSheetProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [selected, setSelected] = useState<Program | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);

  const fail = useCallback(
    (error: unknown) => {
      toast.error(
        t("diary.actionError", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    },
    [toast, t],
  );

  const select = useCallback(
    (id: number) => programApi.get(id).then(setSelected).catch(fail),
    [fail],
  );

  useEffect(() => {
    programApi
      .list()
      .then((list) => {
        setPrograms(list);
        const active = list.find((p) => p.is_active);
        if (active) void select(active.id);
      })
      .catch((error: unknown) => {
        setPrograms([]);
        fail(error);
      });
    // Once per opening: the sheet is mounted while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** null clears the manual week and returns to auto-advance */
  const setWeek = (week: number | null) => {
    if (!selected) return;
    programApi
      .setWeekCursor(selected.id, week)
      .then(() => select(selected.id))
      .catch(fail);
  };
  const week = selected?.current_week || 1;
  const weeks = selected?.duration_weeks || 1;
  const isLooping = selected?.on_complete === "repeat";

  const load = (template: Template) => {
    if (!selected) return;
    setPreview(null);
    onLoad({ template, program: selected });
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onOpenChange={(isStillOpen) => {
          if (!isStillOpen) onClose();
        }}
        title={t("diary.load.title")}
      >
        {programs === null ? (
          <Row justify="center" padding={4}>
            <Spinner label={t("diary.load.loading")} />
          </Row>
        ) : programs.length === 0 ? (
          <EmptyState text={t("diary.load.noPrograms")} />
        ) : (
          <Stack gap={3}>
            <Row
              gap={2}
              shouldWrap
              role="group"
              aria-label={t("diary.load.programs")}
            >
              {programs.map((program) => (
                <Button
                  key={program.id}
                  size="sm"
                  variant={
                    selected?.id === program.id ? "primary" : "secondary"
                  }
                  aria-pressed={selected?.id === program.id}
                  text={
                    program.is_active
                      ? `${program.name} · ${t("diary.load.active")}`
                      : program.name
                  }
                  onClick={() => void select(program.id)}
                />
              ))}
            </Row>

            {selected?.is_active && weeks > 1 && (
              <Row gap={2} align="center" justify="center">
                <Button
                  size="sm"
                  aria-label={t("diary.load.regressWeek")}
                  isDisabled={week <= 1}
                  onClick={() => {
                    setWeek(week - 1);
                  }}
                >
                  <ChevronLeft aria-hidden size={16} />
                </Button>
                <Text variant="small">
                  {t("diary.load.week", { week, total: weeks })}
                </Text>
                <Button
                  size="sm"
                  aria-label={t("diary.load.advanceWeek")}
                  isDisabled={!isLooping && week >= weeks}
                  onClick={() => {
                    if (week < weeks) setWeek(week + 1);
                    else if (isLooping) setWeek(1);
                  }}
                >
                  <ChevronRight aria-hidden size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  text={t("diary.load.autoWeek")}
                  onClick={() => {
                    setWeek(null);
                  }}
                />
              </Row>
            )}

            {!selected ? (
              <Text tone="muted">{t("diary.load.selectProgram")}</Text>
            ) : !selected.templates?.length ? (
              <EmptyState text={t("diary.load.noTemplates")} />
            ) : (
              <Stack gap={2}>
                {selected.templates.map((template, index) => (
                  <Row key={template.id} gap={2} align="center">
                    <Pressable
                      onPress={() => {
                        load(template);
                      }}
                      align="start"
                      padding={3}
                      surface="surface"
                      shouldGrow
                      canShrink
                    >
                      <Text as="span">{`${index + 1}. ${template.name}`}</Text>
                      <Text variant="caption" tone="muted" as="span">
                        {t("diary.load.exerciseCount", {
                          count: template.exercises.length,
                        })}
                      </Text>
                    </Pressable>
                    <Button
                      size="sm"
                      aria-label={t("diary.load.details", {
                        name: template.name,
                      })}
                      onClick={() => {
                        setPreview(template);
                      }}
                    >
                      <Info aria-hidden size={16} />
                    </Button>
                  </Row>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Sheet>
      <TemplatePreviewSheet
        template={preview}
        unit={unit}
        onClose={() => {
          setPreview(null);
        }}
        onLoad={load}
      />
    </>
  );
}

/** What a template holds, before loading it */
function TemplatePreviewSheet({
  template,
  unit,
  onClose,
  onLoad,
}: {
  template: Template | null;
  unit: string;
  onClose: () => void;
  onLoad: (template: Template) => void;
}) {
  const { t } = useTranslation("training");
  const exercises = template?.exercises ?? [];
  return (
    <Sheet
      isOpen={template !== null}
      onOpenChange={(isStillOpen) => {
        if (!isStillOpen) onClose();
      }}
      title={template?.name ?? ""}
      description={template?.day_label ?? undefined}
      footer={
        <Button
          variant="primary"
          isFullWidth
          text={t("diary.load.load")}
          isDisabled={!exercises.length}
          onClick={() => {
            if (template) onLoad(template);
          }}
        >
          <Play aria-hidden size={16} />
        </Button>
      }
    >
      {!exercises.length ? (
        <EmptyState text={t("diary.load.noTemplateExercises")} />
      ) : (
        <Stack gap={2}>
          {exercises.map((exercise, i) => (
            <Stack key={exercise.uuid ?? i} gap={1}>
              {exercise.superset_id &&
                exercise.superset_id !== exercises[i - 1]?.superset_id && (
                  <Row>
                    <Chip
                      text={t("diary.load.superset")}
                      icon={<Link2 aria-hidden size={12} />}
                    />
                  </Row>
                )}
              <Stack
                gap={0}
                className={
                  exercise.superset_id ? "border-s-2 border-accent/40 ps-3" : ""
                }
              >
                <Text>{`${i + 1}. ${exercise.exercise_name ?? ""}`}</Text>
                <Text variant="mono" tone="muted">
                  {templateTarget(exercise, unit, (reps) =>
                    t("diary.load.repsOnly", { reps }),
                  )}
                </Text>
                {exercise.notes && (
                  <Text variant="caption" tone="muted" shouldKeepLineBreaks>
                    {exercise.notes}
                  </Text>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Sheet>
  );
}
