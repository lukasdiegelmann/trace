import {
  Button,
  Chip,
  EmptyState,
  Island,
  Pressable,
  Row,
  Sheet,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CircleCheck, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { statusOf, type InboxRow, type Prescription } from "./api";
import { useDiaryFormats } from "./format";

export interface CoachSectionProps {
  today: string;
  /** The prescription of the day shown */
  dayPrescription: Prescription | null;
  /** Every pending one, and the undated accepted ones */
  upcoming: Prescription[];
  loadedTemplateId: number | null | undefined;
  hasExercises: boolean;
  isFuture: boolean;
  onAnswer: (prescription: Prescription, answer: "accept" | "decline") => void;
  onLoad: (prescription: Prescription) => void;
  onStartSuggestion: (prescription: Prescription) => void;
}

/** What the coach prescribed or suggests */
export function CoachSection({
  today,
  dayPrescription,
  upcoming,
  loadedTemplateId,
  hasExercises,
  isFuture,
  onAnswer,
  onLoad,
  onStartSuggestion,
}: CoachSectionProps) {
  const { t } = useTranslation("training");
  const { dayTitle } = useDiaryFormats();
  const day =
    dayPrescription &&
    (dayPrescription.id || dayPrescription.template_id) &&
    statusOf(dayPrescription) !== "declined"
      ? dayPrescription
      : null;
  const asking = upcoming.filter(
    (p) => statusOf(p) === "pending" && p.id !== day?.id,
  );
  // Dated ones show in the banner on their day
  const suggested = upcoming.filter(
    (p) => !p.date && statusOf(p) === "accepted",
  );

  const name = (p: Prescription) =>
    p.template_name || p.name || t("diary.prescription.coachPick");
  const coach = (p: Prescription) =>
    p.trainer_name || t("diary.prescription.yourCoach");
  const answers = (p: Prescription) => (
    <Row gap={2} justify="end">
      <Button
        size="sm"
        variant="secondary"
        text={t("diary.prescription.decline")}
        onClick={() => {
          onAnswer(p, "decline");
        }}
      />
      <Button
        size="sm"
        variant="primary"
        text={t("diary.prescription.accept")}
        onClick={() => {
          onAnswer(p, "accept");
        }}
      />
    </Row>
  );

  const isLoaded =
    !!loadedTemplateId && loadedTemplateId === day?.template_id && hasExercises;

  return (
    <>
      {day && (
        <Island tone={statusOf(day) === "pending" ? "waiting" : "accent"}>
          <Stack gap={2}>
            <Stack gap={0}>
              <Text variant="small" tone="muted">
                {t("diary.prescription.title", { name: coach(day) })}
              </Text>
              <Text variant="heading">
                {day.template_name ||
                  day.name ||
                  t("diary.prescription.aWorkout")}
              </Text>
              {day.notes && (
                <Text variant="small" shouldKeepLineBreaks>
                  {day.notes}
                </Text>
              )}
            </Stack>
            {statusOf(day) === "pending" ? (
              answers(day)
            ) : isLoaded ? (
              <Row justify="end">
                <Chip
                  text={t("diary.prescription.loaded")}
                  icon={<CircleCheck aria-hidden size={12} />}
                />
              </Row>
            ) : (
              <Row justify="end">
                <Button
                  size="sm"
                  variant="primary"
                  text={t("diary.prescription.load")}
                  onClick={() => {
                    onLoad(day);
                  }}
                />
              </Row>
            )}
          </Stack>
        </Island>
      )}
      {asking.length > 0 && (
        <Island tone="waiting" title={t("diary.prescription.waiting")}>
          <Stack gap={3}>
            {asking.map((p) => (
              <Stack key={p.id} gap={1}>
                <Text>{name(p)}</Text>
                <Text variant="caption" tone="muted">
                  {[
                    p.date ? dayTitle(p.date, today) : null,
                    p.program_name,
                    t("diary.prescription.from", { name: coach(p) }),
                    p.notes,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {answers(p)}
              </Stack>
            ))}
          </Stack>
        </Island>
      )}
      {suggested.length > 0 && !hasExercises && !isFuture && (
        <Island title={t("diary.prescription.suggested")}>
          <Stack gap={1}>
            {suggested.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  onStartSuggestion(p);
                }}
                align="start"
                padding={2}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Text as="span">{name(p)}</Text>
                  <ChevronRight aria-hidden size={16} />
                </span>
                <Text variant="caption" tone="muted" as="span">
                  {[
                    p.program_name,
                    t("diary.prescription.from", { name: coach(p) }),
                    p.notes,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Pressable>
            ))}
          </Stack>
        </Island>
      )}
    </>
  );
}

export interface CoachInboxSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** null while loading */
  rows: InboxRow[] | null;
  onOpenRow: (row: InboxRow) => void;
  onMarkAll: () => void;
}

/** Every note the coach left; a row jumps to its day */
export function CoachInboxSheet({
  isOpen,
  onClose,
  rows,
  onOpenRow,
  onMarkAll,
}: CoachInboxSheetProps) {
  const { t } = useTranslation("training");
  const { shortDate, ago } = useDiaryFormats();
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(isStillOpen) => {
        if (!isStillOpen) onClose();
      }}
      title={t("diary.inbox.title")}
      actions={
        rows?.some((row) => !row.seen_by_member_at) ? (
          <Button
            size="sm"
            text={t("diary.inbox.markAll")}
            onClick={onMarkAll}
          />
        ) : undefined
      }
    >
      {rows === null ? (
        <Row justify="center" padding={4}>
          <Spinner label={t("diary.inbox.loading")} />
        </Row>
      ) : rows.length === 0 ? (
        <EmptyState text={t("diary.inbox.empty")} />
      ) : (
        <Stack gap={2}>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => {
                onOpenRow(row);
              }}
              align="start"
              padding={3}
              surface="surface"
              className={
                row.seen_by_member_at ? "" : "border-s-4 border-accent"
              }
            >
              <Text variant="caption" tone="muted" as="span">
                {[
                  row.trainer_name,
                  row.workout_date ? shortDate(row.workout_date) : null,
                  row.exercise_name,
                  row.seen_by_member_at ? null : t("diary.inbox.unread"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text as="span" shouldKeepLineBreaks>
                {row.note}
              </Text>
              <Text variant="caption" tone="muted" as="span">
                {ago(row.updated_at)}
              </Text>
            </Pressable>
          ))}
        </Stack>
      )}
    </Sheet>
  );
}
