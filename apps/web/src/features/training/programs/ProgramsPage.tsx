import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Menu,
  Pressable,
  Row,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  CalendarDays,
  ChevronRight,
  EllipsisVertical,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { EmptyNote } from "../common/EmptyNote";
import { LoadFailed, Loading } from "../common/LoadState";
import { ToggleChips } from "../common/ToggleChips";
import { useMediaQuery, WIDE_QUERY } from "../common/useMediaQuery";
import { useResource } from "../common/useResource";
import { useRun } from "../common/useRun";
import { cardProgress, clampWeeks } from "../lib/programs";
import { GOALS } from "../lib/workout";
import {
  activateProgram,
  createProgram,
  deactivatePrograms,
  deleteProgram,
  duplicateProgram,
  getProgram,
  getPrograms,
  type Program,
  type ProgramWithTemplates,
  updateProgram,
} from "./api";
import { goalLabel } from "./goalLabel";
import { NameSheet } from "./NameSheet";

/** /training/programs: the user's training programs */
export function ProgramsPage() {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const isWide = useMediaQuery(WIDE_QUERY);
  const programs = useResource("programs", getPrograms);
  const [isCreating, setIsCreating] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const open = (program: Program) => {
    if (isWide) setPreviewId(program.id);
    else void navigate(`/training/programs/${program.id}`);
  };
  const preview = programs.data?.find((p) => p.id === previewId) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      <Row gap={3} align="center" justify="between">
        <Text variant="title" as="h1">
          {t("programs.title")}
        </Text>
        <Button
          variant="primary"
          text={t("programs.new")}
          onClick={() => {
            setIsCreating(true);
          }}
        >
          <Plus aria-hidden size={18} />
        </Button>
      </Row>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {programs.error && !programs.data ? (
            <LoadFailed error={programs.error} onRetry={programs.reload} />
          ) : !programs.data ? (
            <Loading />
          ) : programs.data.length === 0 ? (
            <EmptyNote
              icon={<CalendarDays aria-hidden />}
              text={t("programs.empty")}
              action={{
                text: t("programs.create"),
                onClick: () => {
                  setIsCreating(true);
                },
              }}
            />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
              {programs.data.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isSelected={isWide && previewId === program.id}
                  onOpen={open}
                />
              ))}
            </ul>
          )}
        </div>
        {isWide && (
          <aside
            aria-label={t("programs.preview.label")}
            className="sticky top-16 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-container border border-border bg-level-1 p-4"
          >
            {preview ? (
              <Preview
                key={preview.id}
                summary={preview}
                onChanged={programs.reload}
                onClose={() => {
                  setPreviewId(null);
                }}
              />
            ) : (
              <EmptyNote
                icon={<CalendarDays aria-hidden />}
                text={t("programs.preview.empty")}
              />
            )}
          </aside>
        )}
      </div>

      <NewProgramSheet
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
        }}
      />
    </div>
  );
}

function ProgramCard({
  program,
  isSelected,
  onOpen,
}: {
  program: Program;
  isSelected: boolean;
  onOpen: (program: Program) => void;
}) {
  const { t } = useTranslation("training");
  const progress = cardProgress(program);
  const parts: string[] = [];
  if (progress?.week) {
    parts.push(
      progress.week.of
        ? t("programs.weekOf", {
            week: progress.week.current,
            weeks: progress.week.of,
          })
        : t("programs.week", { week: progress.week.current }),
    );
  }
  if (progress && progress.sessions > 0) {
    parts.push(t("programs.sessions", { count: progress.sessions }));
  }
  return (
    <li className="flex">
      <Pressable
        className={`flex w-full flex-col gap-2 rounded-container border bg-level-1 p-4 text-left ${
          isSelected || program.is_active ? "border-accent" : "border-border"
        }`}
        label={program.name}
        onPress={() => {
          onOpen(program);
        }}
      >
        <Row gap={2} justify="between" align="center">
          <Text variant="heading">{program.name}</Text>
          {Boolean(program.is_active) && (
            <Chip tone="accent" text={t("programs.active")} />
          )}
        </Row>
        <Row gap={2} align="center" className="flex-wrap">
          {program.goal && <Chip text={goalLabel(t, program.goal)} />}
          <Text variant="small" tone="muted">
            {t("programs.workouts", { count: program.template_count ?? 0 })}
          </Text>
          {Boolean(program.is_assigned) && program.assigned_by_name && (
            <Chip
              tone="muted"
              text={t("programs.coach", { name: program.assigned_by_name })}
            />
          )}
        </Row>
        {parts.length > 0 && (
          <Text variant="caption" tone="muted">
            {parts.join(" · ")}
          </Text>
        )}
      </Pressable>
    </li>
  );
}

function NewProgramSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("training");
  return (
    <Sheet
      isOpen={isOpen}
      title={t("programs.newTitle")}
      onOpenChange={(isUp) => {
        if (!isUp) onClose();
      }}
    >
      {isOpen && <NewProgramForm onClose={onClose} />}
    </Sheet>
  );
}

function NewProgramForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const run = useRun();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("general");
  const [weeks, setWeeks] = useState("1");
  const [isBusy, setIsBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || isBusy) return;
    setIsBusy(true);
    let id = 0;
    const isDone = await run(async () => {
      const program = await createProgram({
        name: name.trim(),
        goal,
        duration_weeks: clampWeeks(weeks),
      });
      id = program.id;
    });
    if (isDone) void navigate(`/training/programs/${id}`);
    else setIsBusy(false);
  };

  return (
    <Stack gap={4}>
      <Input
        label={t("programs.name")}
        placeholder={t("programs.namePlaceholder")}
        value={name}
        maxLength={120}
        onValueChange={setName}
        onEnter={() => void create()}
        autoFocus
      />
      <Field label={t("programs.goal")}>
        <ToggleChips
          label={t("programs.goal")}
          options={GOALS.map((id) => ({ value: id, label: t(`goals.${id}`) }))}
          selected={[goal]}
          onToggle={setGoal}
        />
      </Field>
      <Field label={t("programs.duration")} hint={t("programs.durationHint")}>
        <Input
          type="number"
          min={1}
          max={52}
          aria-label={t("programs.duration")}
          value={weeks}
          onValueChange={setWeeks}
        />
      </Field>
      <Row gap={2} justify="end">
        <Button text={t("common.cancel")} onClick={onClose} />
        <Button
          variant="primary"
          text={t("programs.create")}
          isLoading={isBusy}
          isDisabled={!name.trim()}
          onClick={() => void create()}
        />
      </Row>
    </Stack>
  );
}

function Preview({
  summary,
  onChanged,
  onClose,
}: {
  summary: Program;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const run = useRun();
  const full = useResource(
    `program-${summary.id}`,
    (): Promise<ProgramWithTemplates> => getProgram(summary.id),
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const templates = full.data?.templates;
  // The list knows whether it is active; the detail fills in the rest.
  const program = { ...full.data, ...summary };
  const changed = () => {
    onChanged();
    full.reload();
  };

  return (
    <Stack gap={3}>
      <Row gap={2} justify="between" align="start">
        <Stack gap={1}>
          <Text variant="heading" as="h2">
            {program.name}
          </Text>
          <Row gap={2} align="center" className="flex-wrap">
            {program.goal && <Chip text={goalLabel(t, program.goal)} />}
            {(program.duration_weeks ?? 1) > 1 && (
              <Text variant="small" tone="muted">
                {t("programs.weeks", { count: program.duration_weeks ?? 1 })}
              </Text>
            )}
            {Boolean(program.is_active) && (
              <Chip tone="accent" text={t("programs.active")} />
            )}
          </Row>
        </Stack>
        <Row gap={1}>
          <Menu
            label={t("programs.actions")}
            align="end"
            items={[
              {
                id: "rename",
                text: t("programs.rename"),
                onSelect: () => {
                  setIsRenaming(true);
                },
              },
              {
                id: "duplicate",
                text: t("programs.duplicate"),
                onSelect: () =>
                  void run(async () => {
                    const copy = await duplicateProgram(full.data ?? summary);
                    void navigate(`/training/programs/${copy.id}`);
                  }, t("programs.duplicated")),
              },
              program.is_active
                ? {
                    id: "deactivate",
                    text: t("programs.deactivate"),
                    onSelect: () =>
                      void run(async () => {
                        await deactivatePrograms();
                        changed();
                      }, t("programs.deactivated")),
                  }
                : {
                    id: "activate",
                    text: t("programs.activate"),
                    onSelect: () =>
                      void run(async () => {
                        await activateProgram(program.id);
                        changed();
                      }, t("programs.activated")),
                  },
              {
                id: "delete",
                text: t("common.delete"),
                tone: "danger",
                hasSeparatorBefore: true,
                onSelect: () => {
                  setIsDeleting(true);
                },
              },
            ]}
          >
            <Button aria-label={t("programs.actions")}>
              <EllipsisVertical aria-hidden size={18} />
            </Button>
          </Menu>
          <Button aria-label={t("programs.preview.close")} onClick={onClose}>
            <X aria-hidden size={18} />
          </Button>
        </Row>
      </Row>
      {program.description && (
        <Text shouldKeepLineBreaks>{program.description}</Text>
      )}
      <Text variant="label" as="h3">
        {t("programs.preview.workouts")}
      </Text>
      {full.error && !templates ? (
        <LoadFailed error={full.error} onRetry={full.reload} />
      ) : !templates ? (
        <Loading />
      ) : templates.length === 0 ? (
        <Text tone="muted">{t("programs.preview.noWorkouts")}</Text>
      ) : (
        <ol className="flex flex-col gap-1">
          {templates.map((template, index) => {
            const name = template.name || t("programs.day", { day: index + 1 });
            return (
              <li key={template.id}>
                <Pressable
                  className="flex w-full flex-row items-center gap-3 rounded-control border border-border p-2 text-left"
                  label={name}
                  onPress={() =>
                    void navigate(
                      `/training/programs/${program.id}/template/${template.id}`,
                    )
                  }
                >
                  <Text variant="small" tone="muted">
                    {index + 1}
                  </Text>
                  <Stack gap={0} className="min-w-0 flex-1">
                    <Text isTruncated>{name}</Text>
                    {(template.exercises?.length ?? 0) > 0 && (
                      <Text variant="caption" tone="muted">
                        {t("programs.exercises", {
                          count: template.exercises?.length ?? 0,
                        })}
                      </Text>
                    )}
                  </Stack>
                  <ChevronRight aria-hidden size={16} />
                </Pressable>
              </li>
            );
          })}
        </ol>
      )}
      <Button
        variant="primary"
        isFullWidth
        text={t("programs.preview.full")}
        onClick={() => void navigate(`/training/programs/${program.id}`)}
      />
      <NameSheet
        isOpen={isRenaming}
        title={t("programs.renameTitle")}
        label={t("programs.name")}
        initialName={program.name}
        confirmText={t("common.save")}
        onClose={() => {
          setIsRenaming(false);
        }}
        onConfirm={async (name) => {
          if (name === program.name) return true;
          return run(async () => {
            await updateProgram(program.id, { name });
            changed();
          }, t("programs.renamed"));
        }}
      />
      <Dialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        variant="danger"
        title={t("programs.deleteTitle")}
        description={t("programs.deleteText")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={async () => {
          await run(async () => {
            await deleteProgram(program.id);
            onClose();
            onChanged();
          }, t("programs.deleted"));
          setIsDeleting(false);
        }}
      />
    </Stack>
  );
}
