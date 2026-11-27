import {
  Avatar,
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Menu,
  type MenuItem,
  Panel,
  Pressable,
  Row,
  SegmentedControl,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleCheck,
  EllipsisVertical,
  GripVertical,
  ListPlus,
  Pencil,
  Play,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";

import { EmptyNote } from "../common/EmptyNote";
import { LoadFailed, Loading } from "../common/LoadState";
import { useMediaQuery, WIDE_QUERY } from "../common/useMediaQuery";
import { useResource } from "../common/useResource";
import { useRun } from "../common/useRun";
import {
  clampWeeks,
  moveItem,
  programAccess,
  targetText,
} from "../lib/programs";
import {
  activateProgram,
  assignProgram,
  createTemplate,
  deactivatePrograms,
  deleteProgram,
  deleteTemplate,
  duplicateProgram,
  getCoachMembers,
  getProgram,
  type ProgramWithTemplates,
  reorderTemplates,
  updateProgram,
  type WorkoutTemplate,
} from "./api";
import { goalLabel } from "./goalLabel";
import { NameSheet } from "./NameSheet";

/** /training/programs/:id */
export function ProgramDetailPage() {
  const { id = "" } = useParams();
  return <ProgramDetail key={id} id={id} />;
}

type OpenSheet = "rename" | "settings" | "assign" | "addWorkout" | null;

function ProgramDetail({ id }: { id: string }) {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const run = useRun();
  const isWide = useMediaQuery(WIDE_QUERY);
  const { sessions } = useAuth();
  const viewer = sessions?.lt.state === "signed-in" ? sessions.lt.user : null;
  const resource = useResource(`program-detail-${id}`, () => getProgram(id));
  const program = resource.data;
  const access = programAccess(program, viewer);

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [confirm, setConfirm] = useState<
    { kind: "program" } | { kind: "workout"; id: number } | null
  >(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const templates = program?.templates ?? [];
  // The pane never sits empty once there are workouts.
  const selected =
    templates.find((template) => template.id === selectedId) ?? templates.at(0);
  const closeSheet = () => {
    setSheet(null);
  };
  const editorPath = (templateId: number) =>
    `/training/programs/${id}/template/${templateId}`;

  const reorder = (from: number, to: number) => {
    if (!program) return;
    const next = moveItem(templates, from, to);
    if (next === templates) return;
    resource.mutate((current) => ({ ...current, templates: next }));
    void run(() =>
      reorderTemplates(
        program.id,
        next.map((template) => template.id),
      ),
    ).then((isDone) => {
      if (!isDone) resource.reload();
    });
  };

  const menu: MenuItem[] = [];
  if (program) {
    if (access.isOwner) {
      menu.push(
        {
          id: "rename",
          text: t("programs.rename"),
          onSelect: () => {
            setSheet("rename");
          },
        },
        {
          id: "settings",
          text: t("programDetail.settings.title"),
          onSelect: () => {
            setSheet("settings");
          },
        },
      );
    }
    menu.push({
      id: "duplicate",
      text: t("programs.duplicate"),
      onSelect: () =>
        void run(async () => {
          const copy = await duplicateProgram(program);
          void navigate(`/training/programs/${copy.id}`);
        }, t("programs.duplicated")),
    });
    if (access.canAssign) {
      menu.push({
        id: "assign",
        text: t("programDetail.assign.title"),
        onSelect: () => {
          setSheet("assign");
        },
      });
    }
    if (access.isOwner) {
      menu.push({
        id: "delete",
        text: t("programDetail.deleteProgram"),
        tone: "danger",
        hasSeparatorBefore: true,
        onSelect: () => {
          setConfirm({ kind: "program" });
        },
      });
    }
  }

  const weeks = program?.duration_weeks ?? 1;

  return (
    <Stack gap={4} padding={4}>
      <Row gap={2} align="center">
        <Button
          aria-label={t("common.back")}
          onClick={() => void navigate("/training/programs")}
        >
          <ArrowLeft aria-hidden size={20} />
        </Button>
        <div className="min-w-0 flex-1">
          <Text variant="title" as="h1">
            {program?.name ?? t("programDetail.title")}
          </Text>
        </div>
        {menu.length > 0 && (
          <Menu label={t("programs.actions")} align="end" items={menu}>
            <Button aria-label={t("programs.actions")}>
              <EllipsisVertical aria-hidden size={18} />
            </Button>
          </Menu>
        )}
      </Row>

      {!program ? (
        resource.error ? (
          <LoadFailed error={resource.error} onRetry={resource.reload} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          <Row gap={2} align="center" className="flex-wrap">
            {program.goal && <Chip text={goalLabel(t, program.goal)} />}
            <Text variant="small" tone="muted">
              {t("programs.workouts", { count: templates.length })}
            </Text>
            {weeks > 1 && (
              <Chip
                tone="muted"
                text={
                  program.is_active && program.current_week
                    ? t("programs.weekOf", {
                        week: program.current_week,
                        weeks,
                      })
                    : t("programs.weeks", { count: weeks })
                }
              />
            )}
            {program.is_active ? (
              <Button
                size="sm"
                variant="primary"
                text={t("programs.active")}
                aria-label={t("programDetail.deactivateActive")}
                onClick={() =>
                  void run(async () => {
                    await deactivatePrograms();
                    resource.reload();
                  }, t("programs.deactivated"))
                }
              >
                <CircleCheck aria-hidden size={16} />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                text={t("programs.activate")}
                onClick={() =>
                  void run(async () => {
                    await activateProgram(program.id);
                    resource.reload();
                  }, t("programs.activated"))
                }
              >
                <Play aria-hidden size={16} />
              </Button>
            )}
          </Row>
          {program.description && (
            <Text shouldKeepLineBreaks>{program.description}</Text>
          )}

          <Row gap={2} justify="between" align="center">
            <Text variant="heading" as="h2">
              {t("programs.preview.workouts")}
            </Text>
            {!access.isOthers && (
              <Button
                size="sm"
                variant="secondary"
                text={t("programDetail.add")}
                aria-label={t("programDetail.addWorkout")}
                onClick={() => {
                  setSheet("addWorkout");
                }}
              >
                <Plus aria-hidden size={16} />
              </Button>
            )}
          </Row>

          {templates.length === 0 ? (
            <EmptyNote
              icon={<ListPlus aria-hidden />}
              text={t("programs.preview.noWorkouts")}
              action={
                access.isOthers
                  ? undefined
                  : {
                      text: t("programDetail.addWorkout"),
                      onClick: () => {
                        setSheet("addWorkout");
                      },
                    }
              }
            />
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <TemplateList
                templates={templates}
                isReadOnly={access.isOthers}
                selectedId={isWide ? selected?.id : undefined}
                onOpen={(templateId) => {
                  if (isWide) setSelectedId(templateId);
                  else void navigate(editorPath(templateId));
                }}
                onMove={reorder}
                onDelete={(templateId) => {
                  setConfirm({ kind: "workout", id: templateId });
                }}
              />
              {isWide && selected && (
                <TemplatePreview
                  template={selected}
                  onEdit={() => void navigate(editorPath(selected.id))}
                />
              )}
            </div>
          )}

          <NameSheet
            isOpen={sheet === "rename"}
            title={t("programs.renameTitle")}
            label={t("programs.name")}
            initialName={program.name}
            confirmText={t("common.save")}
            onClose={closeSheet}
            onConfirm={async (name) => {
              if (name === program.name) return true;
              return run(async () => {
                await updateProgram(program.id, { name });
                resource.reload();
              }, t("programs.renamed"));
            }}
          />
          <NameSheet
            isOpen={sheet === "addWorkout"}
            title={t("programDetail.newWorkout")}
            label={t("programs.name")}
            placeholder={t("programDetail.workoutPlaceholder")}
            confirmText={t("programDetail.addWorkout")}
            onClose={closeSheet}
            onConfirm={(name) =>
              run(async () => {
                await createTemplate({ program_id: program.id, name });
                resource.reload();
              }, t("programDetail.workoutAdded"))
            }
          />
          <Sheet
            isOpen={sheet === "settings"}
            title={t("programDetail.settings.title")}
            onOpenChange={(isUp) => {
              if (!isUp) closeSheet();
            }}
          >
            {sheet === "settings" && (
              <SettingsForm
                program={program}
                onClose={closeSheet}
                onSaved={resource.reload}
              />
            )}
          </Sheet>
          <Sheet
            isOpen={sheet === "assign"}
            title={t("programDetail.assign.title")}
            onOpenChange={(isUp) => {
              if (!isUp) closeSheet();
            }}
          >
            {sheet === "assign" && (
              <AssignList program={program} onClose={closeSheet} />
            )}
          </Sheet>
          <Dialog
            open={confirm !== null}
            onOpenChange={(isUp) => {
              if (!isUp) setConfirm(null);
            }}
            variant="danger"
            title={
              confirm?.kind === "workout"
                ? t("programDetail.deleteWorkoutTitle")
                : t("programs.deleteTitle")
            }
            description={
              confirm?.kind === "workout"
                ? t("programDetail.deleteWorkoutText")
                : t("programs.deleteText")
            }
            confirmText={t("common.delete")}
            cancelText={t("common.cancel")}
            onConfirm={async () => {
              if (confirm?.kind === "workout") {
                const templateId = confirm.id;
                await run(async () => {
                  await deleteTemplate(templateId);
                  resource.reload();
                }, t("programDetail.workoutDeleted"));
              } else {
                await run(async () => {
                  await deleteProgram(program.id);
                  void navigate("/training/programs", { replace: true });
                }, t("programs.deleted"));
              }
              setConfirm(null);
            }}
          />
        </>
      )}
    </Stack>
  );
}

interface TemplateListProps {
  templates: WorkoutTemplate[];
  isReadOnly: boolean;
  selectedId?: number;
  onOpen: (id: number) => void;
  onMove: (from: number, to: number) => void;
  onDelete: (id: number) => void;
}

function TemplateList({
  templates,
  isReadOnly,
  selectedId,
  onOpen,
  onMove,
  onDelete,
}: TemplateListProps) {
  const { t } = useTranslation("training");
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);
  return (
    <ol className="flex flex-col gap-2">
      {templates.map((template, index) => {
        const name = template.name || t("programs.day", { day: index + 1 });
        return (
          <li
            key={template.id}
            // TODO(monolithium): a sortable list (drag by finger and keyboard)
            draggable={!isReadOnly}
            onDragStart={(event) => {
              setDraggedFrom(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragOver={(event) => {
              if (draggedFrom !== null) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedFrom !== null) onMove(draggedFrom, index);
              setDraggedFrom(null);
            }}
            onDragEnd={() => {
              setDraggedFrom(null);
            }}
            className={`flex items-center gap-1 rounded-container border bg-level-1 p-1 ${
              selectedId === template.id ? "border-accent" : "border-border"
            }`}
          >
            {!isReadOnly && (
              <GripVertical
                aria-hidden
                size={16}
                className="shrink-0 text-muted pointer-coarse:hidden"
              />
            )}
            <Pressable
              className="flex min-w-0 flex-1 flex-row items-center gap-3 p-2 text-left"
              label={name}
              onPress={() => {
                onOpen(template.id);
              }}
            >
              <Text variant="small" tone="muted">
                {index + 1}
              </Text>
              <Stack gap={0} className="min-w-0 flex-1">
                <Text isTruncated>{name}</Text>
                <Text variant="caption" tone="muted">
                  {t("programs.exercises", {
                    count: template.exercises?.length ?? 0,
                  })}
                </Text>
              </Stack>
              <ChevronRight aria-hidden size={16} />
            </Pressable>
            {!isReadOnly && (
              <>
                <Button
                  size="sm"
                  aria-label={t("programDetail.moveUp", { name })}
                  isDisabled={index === 0}
                  onClick={() => {
                    onMove(index, index - 1);
                  }}
                >
                  <ArrowUp aria-hidden size={16} />
                </Button>
                <Button
                  size="sm"
                  aria-label={t("programDetail.moveDown", { name })}
                  isDisabled={index === templates.length - 1}
                  onClick={() => {
                    onMove(index, index + 1);
                  }}
                >
                  <ArrowDown aria-hidden size={16} />
                </Button>
                <Button
                  size="sm"
                  aria-label={t("programDetail.deleteWorkout", { name })}
                  onClick={() => {
                    onDelete(template.id);
                  }}
                >
                  <X aria-hidden size={16} />
                </Button>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TemplatePreview({
  template,
  onEdit,
}: {
  template: WorkoutTemplate;
  onEdit: () => void;
}) {
  const { t } = useTranslation("training");
  const exercises = template.exercises ?? [];
  return (
    <Panel>
      <Stack gap={3}>
        <Stack gap={0}>
          <Text variant="heading" as="h3">
            {template.name}
          </Text>
          <Text variant="caption" tone="muted">
            {t("programs.exercises", { count: exercises.length })}
          </Text>
        </Stack>
        {exercises.length === 0 ? (
          <Text tone="muted">{t("programDetail.noExercises")}</Text>
        ) : (
          <ol className="flex flex-col gap-2">
            {exercises.map((exercise, index) => (
              <li key={`${exercise.id ?? ""}-${index}`}>
                <Row gap={3} justify="between" className="flex-wrap">
                  <Text variant="small">
                    {index + 1}.{" "}
                    {exercise.name ||
                      exercise.exercise_name ||
                      t("programDetail.exercise")}
                  </Text>
                  <Text variant="small" tone="muted">
                    {targetText(exercise)}
                  </Text>
                </Row>
              </li>
            ))}
          </ol>
        )}
        <Button
          variant="primary"
          text={t("programDetail.editWorkout")}
          onClick={onEdit}
        >
          <Pencil aria-hidden size={16} />
        </Button>
      </Stack>
    </Panel>
  );
}

function SettingsForm({
  program,
  onClose,
  onSaved,
}: {
  program: ProgramWithTemplates;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("training");
  const run = useRun();
  const [weeks, setWeeks] = useState(String(program.duration_weeks || 1));
  const [advance, setAdvance] = useState(program.advance_mode || "sessions");
  const [onComplete, setOnComplete] = useState(program.on_complete || "hold");
  const [isBusy, setIsBusy] = useState(false);

  const save = async () => {
    setIsBusy(true);
    const isDone = await run(async () => {
      await updateProgram(program.id, {
        duration_weeks: clampWeeks(weeks),
        advance_mode: advance,
        on_complete: onComplete,
      });
      onSaved();
    }, t("programDetail.settings.saved"));
    if (isDone) onClose();
    else setIsBusy(false);
  };

  return (
    <Stack gap={4}>
      <Field
        label={t("programs.duration")}
        hint={t("programDetail.settings.durationHint")}
      >
        <Input
          type="number"
          min={1}
          max={52}
          aria-label={t("programs.duration")}
          value={weeks}
          onValueChange={setWeeks}
        />
      </Field>
      {clampWeeks(weeks) > 1 && (
        <>
          <Field label={t("programDetail.settings.advanceBy")}>
            <SegmentedControl<"sessions" | "calendar">
              aria-label={t("programDetail.settings.advanceBy")}
              value={advance}
              onChange={setAdvance}
              options={(["sessions", "calendar"] as const).map((value) => ({
                value,
                label: t(`programDetail.settings.advance.${value}`),
              }))}
            />
          </Field>
          <Field label={t("programDetail.settings.pastEnd")}>
            <SegmentedControl<"hold" | "repeat">
              aria-label={t("programDetail.settings.pastEnd")}
              value={onComplete}
              onChange={setOnComplete}
              options={(["hold", "repeat"] as const).map((value) => ({
                value,
                label: t(`programDetail.settings.onComplete.${value}`),
              }))}
            />
          </Field>
        </>
      )}
      <Row gap={2} justify="end">
        <Button text={t("common.cancel")} onClick={onClose} />
        <Button
          variant="primary"
          text={t("common.save")}
          isLoading={isBusy}
          onClick={() => void save()}
        />
      </Row>
    </Stack>
  );
}

/** A coach gives the program to one of their clients */
function AssignList({
  program,
  onClose,
}: {
  program: ProgramWithTemplates;
  onClose: () => void;
}) {
  const { t } = useTranslation("training");
  const run = useRun();
  const members = useResource("coach-members", getCoachMembers);
  const [isAssigning, setIsAssigning] = useState(false);

  if (!members.data) {
    return members.error ? (
      <LoadFailed error={members.error} onRetry={members.reload} />
    ) : (
      <Loading />
    );
  }
  if (members.data.length === 0) {
    return <EmptyNote text={t("programDetail.assign.noClients")} />;
  }
  return (
    <Stack gap={3}>
      <Text variant="small" tone="muted">
        {t("programDetail.assign.hint", { name: program.name })}
      </Text>
      <ul className="flex flex-col gap-2">
        {members.data.map((member) => {
          const name = member.full_name || member.username;
          return (
            <li key={member.id}>
              <Pressable
                className="flex w-full flex-row items-center gap-3 rounded-container border border-border p-3 text-left"
                label={name}
                isDisabled={isAssigning}
                onPress={() => {
                  setIsAssigning(true);
                  void run(
                    () => assignProgram(program.id, member.id),
                    t("programDetail.assign.done", { name }),
                  ).then((isDone) => {
                    if (isDone) onClose();
                    else setIsAssigning(false);
                  });
                }}
              >
                <Avatar name={name} />
                <Stack gap={0} className="min-w-0 flex-1">
                  <Text isTruncated>{name}</Text>
                  <Text variant="caption" tone="muted">
                    {member.active_program
                      ? t("programDetail.assign.current", {
                          name: member.active_program,
                        })
                      : t("programDetail.assign.noProgram")}
                  </Text>
                </Stack>
                <ChevronRight aria-hidden size={16} />
              </Pressable>
            </li>
          );
        })}
      </ul>
    </Stack>
  );
}
