/** One client: summary, conversation, programs, prescriptions, workouts */
import {
  Box,
  Button,
  Chip,
  Grid,
  Pressable,
  Row,
  Spinner,
  Stack,
  Stat,
  Text,
  Tile,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  MessageSquare,
  MessageSquareDot,
  Pencil,
  Play,
  Plus,
  UserMinus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import {
  formatWeekday,
  isoDay,
  memberLabel,
  prescriptionChips,
  type PrescriptionChip,
} from "@/features/training/lib/coaching";
import { GOALS, type GoalId } from "@/features/training/lib/workout";

import { EmptyNote } from "../common/EmptyNote";
import {
  coachingApi,
  type AssignedProgram,
  type MemberOverview,
  type Prescription,
  type RecentWorkout,
} from "./api";
import { AssignProgramSheet } from "./AssignProgramSheet";
import { coachingStore } from "./coachingStore";
import { Conversation } from "./Conversation";
import { coachingErrorText } from "./errorText";
import { EditPrescriptionSheet, PrescribeSheet } from "./PrescriptionSheets";
import { useLtUserId } from "./useCoachingState";
import { useConfirm } from "./useConfirm";
import { useResource } from "./useResource";
import { WorkoutDetailSheet } from "./WorkoutDetailSheet";

/** The router state an activity row hands over */
export interface ClientRouteState {
  openWorkoutDate?: string;
}

type OpenSheet =
  | { kind: "assign" }
  | { kind: "prescribe" }
  | { kind: "edit"; prescription: Prescription }
  | { kind: "workout"; date: string };

export function ClientDetail({ memberId }: { memberId: number }) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm, dialog } = useConfirm();

  const isValid = Number.isInteger(memberId) && memberId > 0;
  const overview = useResource(isValid ? `overview:${memberId}` : null, () =>
    coachingApi.overview(memberId),
  );
  const prescriptions = useResource(
    isValid ? `prescriptions:${memberId}` : null,
    () => coachingApi.prescriptions(memberId),
  );

  const deepLink = (location.state as ClientRouteState | null)?.openWorkoutDate;
  const [sheet, setSheet] = useState<OpenSheet | null>(() =>
    deepLink ? { kind: "workout", date: deepLink } : null,
  );
  // Once is enough: going back and forth doesn't open it again.
  useEffect(() => {
    if (deepLink) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  }, [deepLink, location.pathname, navigate]);

  const data = overview.data;
  const name = data ? memberLabel(data.user) : t("coaching.clientFallback");
  const closeSheet = () => {
    setSheet(null);
  };
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(coachingErrorText(error, t));
    }
  };

  const endCoaching = async () => {
    const isConfirmed = await confirm({
      title: t("coaching.end.title", { name }),
      message: t("coaching.end.message", { name }),
      confirmText: t("coaching.end.confirm"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await coachingApi.endCoaching(memberId);
      toast.info(t("coaching.end.done", { name }));
      void coachingStore.refresh();
      await navigate("/training/coaching");
    });
  };

  const makeActive = (program: AssignedProgram) =>
    run(async () => {
      await coachingApi.assignProgram(program.id, {
        user_id: memberId,
        make_active: true,
      });
      toast.info(
        t("coaching.programs.nowActive", { program: program.name, name }),
      );
      await overview.reload();
    });

  const removeProgram = async (program: AssignedProgram) => {
    const isConfirmed = await confirm({
      title: t("coaching.programs.removeTitle"),
      message: t("coaching.programs.removeMessage", {
        program: program.name,
        name,
      }),
      confirmText: t("coaching.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await coachingApi.unassignProgram(program.id, memberId);
      toast.info(t("coaching.programs.removed"));
      await overview.reload();
    });
  };

  const removePrescription = async (prescription: Prescription) => {
    const isConfirmed = await confirm({
      title: t("coaching.prescriptions.removeTitle"),
      message: t("coaching.prescriptions.removeMessage"),
      confirmText: t("coaching.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await coachingApi.deletePrescription(prescription.id);
      prescriptions.setData((current) =>
        current.filter((p) => p.id !== prescription.id),
      );
      toast.info(t("coaching.prescriptions.removed"));
    });
  };

  return (
    <Stack gap={4} padding={4} fill="width" maxWidth="2xl" isCentered>
      <Row gap={2} align="center">
        <Button
          size="md"
          aria-label={t("common.back")}
          onClick={() => {
            void navigate("/training/coaching");
          }}
        >
          <ArrowLeft aria-hidden size={20} />
        </Button>
        <Box shouldGrow>
          <Text variant="title" as="h1" isTruncated>
            {name}
          </Text>
        </Box>
        {data ? (
          <Button
            variant="danger"
            size="md"
            aria-label={t("coaching.end.action")}
            onClick={() => {
              void endCoaching();
            }}
          >
            <UserMinus aria-hidden size={20} />
          </Button>
        ) : null}
      </Row>

      {overview.isLoading ? (
        <Spinner size="lg" label={t("coaching.loadingOverview")} />
      ) : !data ? (
        <EmptyNote text={t("coaching.clientNotLoaded")} />
      ) : (
        <Overview
          memberId={memberId}
          overview={data}
          prescriptions={prescriptions.data}
          prescriptionsError={prescriptions.error}
          onAssign={() => {
            setSheet({ kind: "assign" });
          }}
          onMakeActive={(program) => {
            void makeActive(program);
          }}
          onRemoveProgram={(program) => {
            void removeProgram(program);
          }}
          onPrescribe={() => {
            setSheet({ kind: "prescribe" });
          }}
          onEditPrescription={(prescription) => {
            setSheet({ kind: "edit", prescription });
          }}
          onRemovePrescription={(prescription) => {
            void removePrescription(prescription);
          }}
          onOpenWorkout={(workout) => {
            setSheet({ kind: "workout", date: workout.date });
          }}
        />
      )}

      {data && sheet?.kind === "assign" ? (
        <AssignProgramSheet
          memberId={memberId}
          memberName={name}
          onClose={closeSheet}
          onAssigned={() => {
            void overview.reload();
          }}
        />
      ) : null}
      {data && sheet?.kind === "prescribe" ? (
        <PrescribeSheet
          memberId={memberId}
          onClose={closeSheet}
          onSaved={() => {
            void prescriptions.reload();
          }}
        />
      ) : null}
      {data && sheet?.kind === "edit" ? (
        <EditPrescriptionSheet
          prescription={sheet.prescription}
          onClose={closeSheet}
          onSaved={() => {
            void prescriptions.reload();
          }}
        />
      ) : null}
      {data && sheet?.kind === "workout" ? (
        <WorkoutDetailSheet
          key={sheet.date}
          memberId={memberId}
          memberName={name}
          memberAvatar={data.user.avatar_url}
          weightUnit={data.weight_unit || "lbs"}
          date={sheet.date}
          onClose={closeSheet}
          onNotesChanged={() => {
            void overview.reload();
          }}
        />
      ) : null}
      {dialog}
    </Stack>
  );
}

interface OverviewProps {
  memberId: number;
  overview: MemberOverview;
  prescriptions: Prescription[] | undefined;
  prescriptionsError: unknown;
  onAssign: () => void;
  onMakeActive: (program: AssignedProgram) => void;
  onRemoveProgram: (program: AssignedProgram) => void;
  onPrescribe: () => void;
  onEditPrescription: (prescription: Prescription) => void;
  onRemovePrescription: (prescription: Prescription) => void;
  onOpenWorkout: (workout: RecentWorkout) => void;
}

function Overview(props: OverviewProps) {
  const { overview, prescriptions, memberId } = props;
  const { t } = useTranslation("training");
  const myId = useLtUserId();
  const name = memberLabel(overview.user);
  const goalText = (goal: string | null) => {
    if (!goal) return t("coaching.goals.general");
    return (GOALS as readonly string[]).includes(goal)
      ? t(`coaching.goals.${goal as GoalId}`)
      : goal;
  };

  return (
    <>
      <Tile>
        <Grid columns={3} gap={2}>
          <Stat
            label={t("coaching.summary.streak")}
            value={String(overview.streak)}
          />
          <Stat
            label={t("coaching.summary.recent")}
            value={String(
              overview.recent_workouts.filter((w) => w.completed).length,
            )}
          />
          <Stat
            label={t("coaching.summary.active")}
            value={overview.active_program?.name ?? "—"}
          />
        </Grid>
      </Tile>

      {overview.pairing_id && myId !== null ? (
        <Stack as="section" gap={2}>
          <Text variant="heading" as="h2">
            {t("conversation.title")}
          </Text>
          <Conversation
            key={overview.pairing_id}
            conversation={{
              side: "coach",
              pairingId: overview.pairing_id,
              clientId: memberId,
            }}
            otherName={name}
            myId={myId}
          />
        </Stack>
      ) : null}

      <Stack as="section" gap={2}>
        <SectionHead
          title={t("coaching.programs.title")}
          actionText={t("coaching.programs.assign")}
          onAction={props.onAssign}
        />
        {overview.assigned_programs.length === 0 ? (
          <EmptyNote text={t("coaching.programs.none")} />
        ) : (
          overview.assigned_programs.map((program) => (
            <Tile key={program.id}>
              <Row gap={3} align="center">
                <CalendarDays aria-hidden size={20} className="text-muted" />
                <Box shouldGrow>
                  <Text variant="small" as="div">
                    {program.name}
                  </Text>
                  <Text variant="caption" as="div">
                    {goalText(program.goal)}
                  </Text>
                </Box>
                {program.active ? (
                  <Chip tone="accent" text={t("coaching.programs.active")} />
                ) : (
                  <Button
                    size="sm"
                    aria-label={t("coaching.programs.makeActive", {
                      program: program.name,
                    })}
                    onClick={() => {
                      props.onMakeActive(program);
                    }}
                  >
                    <Play aria-hidden size={16} />
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={t("coaching.programs.removeNamed", {
                    program: program.name,
                  })}
                  onClick={() => {
                    props.onRemoveProgram(program);
                  }}
                >
                  <X aria-hidden size={16} />
                </Button>
              </Row>
            </Tile>
          ))
        )}
      </Stack>

      <Stack as="section" gap={2}>
        <SectionHead
          title={t("coaching.prescriptions.title")}
          actionText={t("coaching.prescribe.confirm")}
          onAction={props.onPrescribe}
        />
        {!prescriptions ? (
          props.prescriptionsError ? (
            <Text tone="danger" role="alert">
              {coachingErrorText(props.prescriptionsError, t)}
            </Text>
          ) : (
            <Spinner label={t("common.loading")} />
          )
        ) : prescriptions.length === 0 ? (
          <EmptyNote text={t("coaching.prescriptions.none")} />
        ) : (
          prescriptions.map((prescription) => (
            <PrescriptionRow
              key={prescription.id}
              prescription={prescription}
              onEdit={() => {
                props.onEditPrescription(prescription);
              }}
              onRemove={() => {
                props.onRemovePrescription(prescription);
              }}
            />
          ))
        )}
      </Stack>

      <Stack as="section" gap={2}>
        <Text variant="heading" as="h2">
          {t("coaching.recent.title")}
        </Text>
        {overview.recent_workouts.length === 0 ? (
          <EmptyNote text={t("coaching.recent.none")} />
        ) : (
          overview.recent_workouts.map((workout) => (
            <WorkoutRow
              key={workout.id}
              workout={workout}
              weightUnit={overview.weight_unit || "lbs"}
              onPress={() => {
                props.onOpenWorkout(workout);
              }}
            />
          ))
        )}
      </Stack>
    </>
  );
}

function SectionHead({
  title,
  actionText,
  onAction,
}: {
  title: string;
  actionText: string;
  onAction: () => void;
}) {
  return (
    <Row gap={2} align="center" justify="between">
      <Text variant="heading" as="h2">
        {title}
      </Text>
      <Button
        variant="secondary"
        size="sm"
        text={actionText}
        onClick={onAction}
      >
        <Plus aria-hidden size={14} />
      </Button>
    </Row>
  );
}

const CHIP_TONES: Record<PrescriptionChip, "default" | "accent" | "danger"> = {
  waiting: "accent",
  declined: "danger",
  accepted: "default",
  completed: "default",
  missed: "danger",
};

function PrescriptionRow({
  prescription,
  onEdit,
  onRemove,
}: {
  prescription: Prescription;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t, i18n } = useTranslation("training");
  const workout =
    prescription.template_name ||
    prescription.name ||
    t("coaching.prescriptions.customWorkout");
  const isDone = prescription.completed === 1;
  return (
    <Tile>
      <Row gap={3} align="center">
        {isDone ? (
          <CircleCheck aria-hidden size={20} className="text-success" />
        ) : (
          <ClipboardList aria-hidden size={20} className="text-accent-text" />
        )}
        <Box shouldGrow>
          <Text variant="small" as="div">
            {prescription.program_name
              ? `${workout} · ${prescription.program_name}`
              : workout}
          </Text>
          <Row gap={2} align="center" shouldWrap>
            <Text variant="caption">
              {prescription.date
                ? formatWeekday(prescription.date, i18n.language)
                : t("coaching.prescriptions.noDay")}
            </Text>
            {prescriptionChips(prescription, isoDay(new Date())).map((chip) => (
              <Chip
                key={chip}
                tone={CHIP_TONES[chip]}
                text={t(`coaching.prescriptions.status.${chip}`)}
              />
            ))}
          </Row>
          {prescription.notes ? (
            <Text variant="caption" as="div" shouldKeepLineBreaks>
              {prescription.notes}
            </Text>
          ) : null}
        </Box>
        <Button
          size="sm"
          aria-label={t("coaching.prescriptions.edit", { workout })}
          onClick={onEdit}
        >
          <Pencil aria-hidden size={16} />
        </Button>
        <Button
          variant="danger"
          size="sm"
          aria-label={t("coaching.prescriptions.removeNamed", { workout })}
          onClick={onRemove}
        >
          <X aria-hidden size={16} />
        </Button>
      </Row>
    </Tile>
  );
}

function WorkoutRow({
  workout,
  weightUnit,
  onPress,
}: {
  workout: RecentWorkout;
  weightUnit: string;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation("training");
  const details = [
    formatWeekday(workout.date, i18n.language),
    workout.exercise_count
      ? t("coaching.exerciseCount", { count: workout.exercise_count })
      : null,
    workout.set_count
      ? t("coaching.setCount", { count: workout.set_count })
      : null,
    workout.duration_min
      ? t("coaching.minutesShort", { n: Math.round(workout.duration_min) })
      : null,
  ].filter(Boolean);
  const marker =
    workout.my_feedback_count > 0
      ? workout.my_reply_count > 0
        ? {
            Icon: MessageSquareDot,
            text: t("coaching.recent.replied"),
            className: "text-accent-text",
          }
        : {
            Icon: MessageSquare,
            text: t("coaching.recent.noteLeft"),
            className: "text-accent-text",
          }
      : workout.feedback_count > 0
        ? {
            Icon: MessageSquare,
            text: t("coaching.recent.otherCoach"),
            className: "text-muted opacity-50",
          }
        : null;

  return (
    <Pressable
      fill="width"
      padding={3}
      border="all"
      radius="lg"
      onPress={onPress}
    >
      <Row gap={3} align="center">
        <CircleCheck aria-hidden size={20} className="text-success" />
        <Box shouldGrow>
          <Text variant="small" as="div">
            {workout.name || t("coaching.recent.workout")}
          </Text>
          <Text variant="caption" as="div">
            {details.join(" · ")}
          </Text>
        </Box>
        {marker ? (
          <span title={marker.text} className={marker.className}>
            <marker.Icon aria-hidden size={18} />
            <span className="sr-only">{marker.text}</span>
          </span>
        ) : null}
        {workout.volume > 0 ? (
          <Text variant="mono">
            {workout.volume.toLocaleString(i18n.language)} {weightUnit}
          </Text>
        ) : null}
        <ChevronRight aria-hidden size={18} className="text-muted" />
      </Row>
    </Pressable>
  );
}
