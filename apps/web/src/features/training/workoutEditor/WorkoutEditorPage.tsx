/**
 * The editor of one workout of a program (a template), ported from LiftTrace
 * `routes/WorkoutEditor.svelte`. Route:
 * `/training/programs/:programId/templates/:templateId`.
 */
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
  useToast,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  ListPlus,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker, useNavigate, useParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";

import { programApi, type Template } from "../diary/api";
import { ExercisePickerSheet } from "../diary/ExercisePickerSheet";
import { setLtSetting, useLtSettings } from "../diary/ltSettings";
import type { Exercise } from "../exercises/api";
import { ExerciseInfoSheet } from "../exercises/ExerciseInfoSheet";
import {
  existingSupersets,
  groupExercises,
  isInSuperset,
  type SupersetId,
} from "../lib/supersets";
import * as edit from "../lib/templateEdit";
import type { LoadType, SetType, WorkoutExercise } from "../lib/workoutTypes";
import { diffTombstones } from "../lib/workoutUuid";
import { ActionMenu } from "./ActionMenu";
import { SupersetSheets, type SupersetSheetState } from "./SupersetSheets";
import { TemplateExerciseCard } from "./TemplateExerciseCard";

interface Draft {
  name: string;
  exercises: WorkoutExercise[];
}

interface Loaded {
  template: Template;
  /** The program's maker; null when unknown */
  makerId: number | null;
}

/** What the exercise picker's choice is for */
type PickerTarget =
  | { kind: "add" }
  | { kind: "replace"; idx: number }
  | { kind: "superset"; id: SupersetId };

export function WorkoutEditorPage() {
  const { programId, templateId } = useParams();
  return (
    <TemplateLoader
      key={`${programId ?? ""}/${templateId ?? ""}`}
      programId={Number(programId)}
      templateId={Number(templateId)}
    />
  );
}

function TemplateLoader({
  programId,
  templateId,
}: {
  programId: number;
  templateId: number;
}) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  // The toast context may change identity; loading must not repeat for it
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    let isCurrent = true;
    // Both before showing: nothing is editable while the maker is unknown
    void Promise.all([
      programApi.template(templateId),
      programApi.get(programId).catch(() => null),
    ]).then(
      ([template, program]) => {
        if (!isCurrent) return;
        setLoaded({ template, makerId: program?.created_by ?? null });
      },
      (error: unknown) => {
        if (!isCurrent) return;
        setHasFailed(true);
        toastRef.current.error(
          error instanceof Error ? error.message : String(error),
        );
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [programId, templateId]);

  if (loaded) {
    return <Editor {...loaded} programId={programId} templateId={templateId} />;
  }
  return (
    <Stack gap={3} padding={4}>
      <Row>
        <Button
          size="sm"
          aria-label={t("workoutEditor.back")}
          onClick={() => {
            void navigate(`/training/programs/${programId}`);
          }}
        >
          <ArrowLeft size={18} />
        </Button>
      </Row>
      {hasFailed ? (
        <EmptyState text={t("workoutEditor.loadError")} />
      ) : (
        <Spinner size="lg" label={t("workoutEditor.loading")} />
      )}
    </Stack>
  );
}

function Editor({
  template,
  makerId,
  programId,
  templateId,
}: Loaded & { programId: number; templateId: number }) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const { sessions } = useAuth();
  const settings = useLtSettings();

  // The copy as loaded: save() diffs against it for the deletions (issue #85)
  const [original] = useState<Draft>(() => ({
    name: template.name,
    exercises: template.exercises,
  }));
  const [draft, setDraft] = useState<Draft>(original);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [infoIdx, setInfoIdx] = useState<number | null>(null);
  const [supersetSheet, setSupersetSheet] = useState<SupersetSheetState | null>(
    null,
  );
  const [openSupersetMenu, setOpenSupersetMenu] = useState<SupersetId | null>(
    null,
  );
  const [isRemembered, setIsRemembered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const wasSaved = useRef(false);

  const session = sessions?.lt;
  const userId = session?.state === "signed-in" ? session.user.id : null;
  // The server only lets the program's maker change it
  const isReadOnly = userId != null && makerId != null && makerId !== userId;

  const { exercises } = draft;
  const durationWeeks = template.duration_weeks || 1;
  const week = Math.min(selectedWeek, durationWeeks);
  const groups = useMemo(() => groupExercises(exercises), [exercises]);
  const supersets = existingSupersets(exercises);
  const isDirty =
    !isReadOnly && JSON.stringify(draft) !== JSON.stringify(original);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !wasSaved.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [isDirty]);

  const change = (next: (current: WorkoutExercise[]) => WorkoutExercise[]) => {
    if (isReadOnly) return;
    setDraft((current) => ({
      ...current,
      exercises: next(current.exercises),
    }));
  };

  // TODO(monolithium): success tone for toasts
  const confirmToast = (text: string) => {
    toast.show({ text, tone: "info" });
  };

  const pickLoad = (idx: number, next: LoadType) => {
    const id = exercises[idx]?.exercise_id;
    change((current) =>
      current.map((e, i) => (i === idx ? { ...e, load_type: next } : e)),
    );
    if (isRemembered && id != null) {
      setLtSetting("exerciseLoadTypes", {
        ...settings.exerciseLoadTypes,
        [id]: next,
      });
    }
  };

  const pickSetType = (idx: number, next: SetType) => {
    const id = exercises[idx]?.exercise_id;
    change((current) =>
      current.map((e, i) => (i === idx ? { ...e, set_type: next } : e)),
    );
    if (isRemembered && id != null) {
      setLtSetting("exerciseSetTypes", {
        ...settings.exerciseSetTypes,
        [id]: next,
      });
    }
  };

  const select = (picked: Exercise) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!target) return;
    if (target.kind === "replace") {
      change((current) => edit.replaceExercise(current, target.idx, picked));
      confirmToast(
        t("workoutEditor.toast.replacedWith", {
          name: picked.name,
          interpolation: { escapeValue: false },
        }),
      );
      return;
    }
    const added = edit.newTemplateExercise(
      picked,
      settings.exerciseLoadTypes,
      settings.exerciseSetTypes,
    );
    const supersetId = target.kind === "superset" ? target.id : null;
    change((current) => edit.appendExercise(current, added, supersetId));
    if (supersetId != null) {
      confirmToast(t("workoutEditor.toast.addedToSuperset"));
    }
  };

  const exerciseActions = (idx: number): MenuItem[] => {
    const items: MenuItem[] = [];
    for (const [direction, id, text] of [
      [-1, "up", t("workoutEditor.actions.moveUp")],
      [1, "down", t("workoutEditor.actions.moveDown")],
    ] as const) {
      if (edit.moveEditorExercise(exercises, idx, direction) === exercises) {
        continue;
      }
      items.push({
        id,
        text,
        onSelect: () => {
          change((c) => edit.moveEditorExercise(c, idx, direction));
        },
      });
    }
    items.push({
      id: "replace",
      text: t("workoutEditor.actions.replace"),
      shouldReturnFocus: false,
      onSelect: () => {
        setPickerTarget({ kind: "replace", idx });
      },
    });
    if (isInSuperset(exercises[idx])) {
      items.push({
        id: "leave",
        text: t("workoutEditor.actions.leaveSuperset"),
        onSelect: () => {
          change((c) => edit.leaveSuperset(c, idx));
          confirmToast(t("workoutEditor.toast.removedFromSuperset"));
        },
      });
    } else {
      if (supersets.length > 0) {
        items.push({
          id: "join",
          text: t("workoutEditor.actions.joinSuperset"),
          shouldReturnFocus: false,
          onSelect: () => {
            setSupersetSheet({ mode: "join", idx });
          },
        });
      }
      items.push({
        id: "new",
        text: t("workoutEditor.actions.newSuperset"),
        shouldReturnFocus: false,
        onSelect: () => {
          setSupersetSheet({ mode: "new", idx });
        },
      });
    }
    items.push({
      id: "delete",
      text: t("workoutEditor.actions.delete"),
      tone: "danger",
      hasSeparatorBefore: true,
      onSelect: () => {
        change((c) => edit.removeExercise(c, idx));
      },
    });
    return items;
  };

  const supersetActions = (id: SupersetId): MenuItem[] => {
    const items: MenuItem[] = [
      {
        id: "add",
        text: t("workoutEditor.superset.addExercise"),
        shouldReturnFocus: false,
        onSelect: () => {
          setPickerTarget({ kind: "superset", id });
        },
      },
    ];
    if (supersets.some((superset) => superset.id !== id)) {
      items.push({
        id: "merge",
        text: t("workoutEditor.superset.merge"),
        shouldReturnFocus: false,
        onSelect: () => {
          setSupersetSheet({ mode: "merge", id });
        },
      });
    }
    items.push({
      id: "dissolve",
      text: t("workoutEditor.superset.dissolve"),
      tone: "danger",
      hasSeparatorBefore: true,
      onSelect: () => {
        change((c) => edit.dissolveSuperset(c, id));
        confirmToast(t("workoutEditor.toast.supersetDissolved"));
      },
    });
    return items;
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await programApi.saveTemplate(templateId, {
        name: draft.name,
        exercises: edit.forSave(draft.exercises),
        deleted_uuids: diffTombstones(original.exercises, draft.exercises),
      });
      wasSaved.current = true;
      confirmToast(t("workoutEditor.toast.saved"));
      void navigate(`/training/programs/${programId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setIsSaving(false);
    }
  };

  const card = (idx: number, isMember: boolean) => {
    const exercise = exercises[idx];
    const move = (direction: -1 | 1) =>
      edit.moveEditorExercise(exercises, idx, direction) === exercises
        ? null
        : () => {
            change((c) => edit.moveEditorExercise(c, idx, direction));
          };
    return (
      <TemplateExerciseCard
        key={exercise.uuid ?? `${exercise.exercise_id ?? "x"}-${idx}`}
        exercise={exercise}
        loadType={edit.templateLoadType(exercise, settings.exerciseLoadTypes)}
        setType={edit.templateSetType(exercise, settings.exerciseSetTypes)}
        weightUnit={settings.weightUnit}
        week={week}
        durationWeeks={durationWeeks}
        isInSuperset={isMember}
        isReadOnly={isReadOnly}
        hasRpe={settings.trackRpe}
        isRemembered={isRemembered}
        onRememberChange={setIsRemembered}
        onMoveUp={move(-1)}
        onMoveDown={move(1)}
        menuItems={isReadOnly ? [] : exerciseActions(idx)}
        onInfo={() => {
          setInfoIdx(idx);
        }}
        onCopyWeek={() => {
          change((c) => edit.copyWeek(c, week, durationWeeks, idx));
        }}
        onPickLoad={(next) => {
          pickLoad(idx, next);
        }}
        onPickSetType={(next) => {
          pickSetType(idx, next);
        }}
        onWeekValue={(field, value) => {
          change((c) =>
            edit.setWeekValue(c, idx, field, value, week, durationWeeks),
          );
        }}
        onNotes={(notes) => {
          change((c) => c.map((e, i) => (i === idx ? { ...e, notes } : e)));
        }}
        onEnablePerSet={() => {
          change((c) => edit.enablePerSet(c, idx));
        }}
        onDisablePerSet={() => {
          change((c) => edit.disablePerSet(c, idx));
        }}
        onSpecChange={(setIdx, patch) => {
          change((c) => edit.patchSpec(c, idx, setIdx, patch));
        }}
        onSpecNumber={(setIdx, number) => {
          change((c) => edit.setSpecNumber(c, idx, setIdx, number));
        }}
        onSpecRemove={(setIdx) => {
          change((c) => edit.removeSpec(c, idx, setIdx));
        }}
        onSpecAdd={() => {
          change((c) => edit.addSpec(c, idx));
        }}
      />
    );
  };

  const canCopyWeek = exercises.some((e) =>
    edit.differsFromNext(e, week, durationWeeks),
  );
  const infoExercise = infoIdx == null ? undefined : exercises[infoIdx];

  return (
    <Stack gap={3} padding={4}>
      <Row gap={2} align="center">
        <Button
          size="sm"
          aria-label={t("workoutEditor.back")}
          onClick={() => {
            void navigate(`/training/programs/${programId}`);
          }}
        >
          <ArrowLeft size={18} />
        </Button>
        <Input
          wrapperClassName="min-w-0 flex-1"
          aria-label={t("workoutEditor.namePlaceholder")}
          placeholder={t("workoutEditor.namePlaceholder")}
          readOnly={isReadOnly}
          value={draft.name}
          onValueChange={(name) => {
            if (isReadOnly) return;
            setDraft((current) => ({ ...current, name }));
          }}
        />
        {isReadOnly ? (
          <Chip tone="muted" text={t("workoutEditor.readOnly")} />
        ) : (
          <Button
            variant="primary"
            size="md"
            text={t("workoutEditor.save")}
            isLoading={isSaving}
            isDisabled={isSaving}
            onClick={() => {
              void save();
            }}
          />
        )}
      </Row>
      {isReadOnly ? (
        <Text tone="muted">{t("workoutEditor.readOnlyHint")}</Text>
      ) : null}

      {durationWeeks > 1 ? (
        <div
          role="group"
          aria-label={t("workoutEditor.week.label")}
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {Array.from({ length: durationWeeks }, (_, i) => i + 1).map(
            (number) => (
              <div key={number} className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant={week === number ? "primary" : "secondary"}
                  aria-pressed={week === number}
                  text={t("workoutEditor.week.tab", { number })}
                  onClick={() => {
                    setSelectedWeek(number);
                  }}
                />
                {!isReadOnly && week === number && number < durationWeeks ? (
                  // The copy arrow sits between this week and the next
                  <Button
                    size="sm"
                    aria-label={t(
                      canCopyWeek
                        ? "workoutEditor.week.copy"
                        : "workoutEditor.week.matches",
                      { from: week, to: week + 1 },
                    )}
                    isDisabled={!canCopyWeek}
                    onClick={() => {
                      change((c) => edit.copyWeek(c, week, durationWeeks));
                      setSelectedWeek(week + 1);
                    }}
                  >
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
              </div>
            ),
          )}
        </div>
      ) : null}

      {exercises.length === 0 ? (
        <EmptyState
          icon={<ListPlus size={20} />}
          text={t("workoutEditor.emptyHint")}
        />
      ) : (
        groups.map((group) => {
          const id = group.supersetId;
          if (group.type !== "superset" || id == null) {
            return card(group.startIdx, false);
          }
          return (
            <div
              key={`superset-${id}-${group.startIdx}`}
              role="group"
              aria-label={t("workoutEditor.superset.title")}
              className="rounded-container border-2 border-accent bg-level-1"
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Link2 size={16} className="text-accent" aria-hidden />
                <Text variant="label" tone="accent">
                  {t("workoutEditor.superset.title")}
                </Text>
                <div className="flex-1">
                  <Text variant="caption">
                    {t("workoutEditor.superset.count", {
                      count: group.exercises.length,
                    })}
                  </Text>
                </div>
                {isReadOnly ? null : (
                  <ActionMenu
                    label={t("workoutEditor.superset.options")}
                    items={supersetActions(id)}
                    isOpen={openSupersetMenu === id}
                    onOpenChange={(isOpen) => {
                      setOpenSupersetMenu(isOpen ? id : null);
                    }}
                    icon={<MoreHorizontal size={16} />}
                  />
                )}
              </div>
              <div className="divide-y divide-border">
                {group.exercises.map((_, i) => card(group.startIdx + i, true))}
              </div>
            </div>
          );
        })
      )}

      {isReadOnly ? null : (
        <Button
          variant="secondary"
          size="lg"
          isFullWidth
          text={t("workoutEditor.addExercise")}
          onClick={() => {
            setPickerTarget({ kind: "add" });
          }}
        >
          <Plus size={18} />
        </Button>
      )}

      <ExercisePickerSheet
        isOpen={pickerTarget != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPickerTarget(null);
        }}
        onSelect={select}
      />

      <ExerciseInfoSheet
        isOpen={infoExercise != null}
        onClose={() => {
          setInfoIdx(null);
        }}
        exerciseId={infoExercise?.exercise_id || null}
        // Searched for without an id; it also titles the sheet
        exerciseName={infoExercise?.exercise_name ?? null}
        onReplace={
          isReadOnly || infoIdx == null
            ? undefined
            : () => {
                setPickerTarget({ kind: "replace", idx: infoIdx });
                setInfoIdx(null);
              }
        }
      />

      <SupersetSheets
        state={supersetSheet}
        exercises={exercises}
        onClose={() => {
          setSupersetSheet(null);
        }}
        onJoin={(idx, id) => {
          setSupersetSheet(null);
          change((c) => edit.addToSuperset(c, idx, id));
          confirmToast(t("workoutEditor.toast.addedToSuperset"));
        }}
        onCreate={(indices) => {
          setSupersetSheet(null);
          change((c) => edit.startSuperset(c, indices));
          confirmToast(t("workoutEditor.toast.supersetCreated"));
        }}
        onMerge={(source, target) => {
          setSupersetSheet(null);
          change((c) => edit.mergeSupersets(c, source, target));
          confirmToast(t("workoutEditor.toast.supersetsMerged"));
        }}
      />

      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(isOpen) => {
          if (!isOpen) blocker.reset?.();
        }}
        title={t("workoutEditor.unsaved.title")}
        description={t("workoutEditor.unsaved.description")}
        confirmText={t("workoutEditor.unsaved.discard")}
        cancelText={t("workoutEditor.unsaved.keep")}
        variant="danger"
        onConfirm={() => {
          blocker.proceed?.();
        }}
      />
    </Stack>
  );
}
