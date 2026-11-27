import {
  Button,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronDown, ChevronRight, Link2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { getCollapseState, setCollapsed } from "../lib/cardCollapse";
import type { SupersetId } from "../lib/supersets";
import type { WorkoutExercise } from "../lib/workoutTypes";

export interface SupersetCardProps {
  supersetId: SupersetId;
  exercises: WorkoutExercise[];
  date: string;
  shouldAutoCollapse: boolean;
  onRemove: () => void;
  onAddExercise: () => void;
  /** The members' cards */
  children: ReactNode;
}

/** Exercises done back to back, drawn as one block */
export function SupersetCard({
  supersetId,
  exercises,
  date,
  shouldAutoCollapse,
  onRemove,
  onAddExercise,
  children,
}: SupersetCardProps) {
  const { t } = useTranslation("training");
  const rowKey = `ss:${supersetId}`;
  const sets = exercises.flatMap((e) => e.sets ?? []);
  const doneCount = sets.filter((s) => s.completed).length;
  const isAllDone =
    sets.length > 0 &&
    exercises.every(
      (e) => (e.sets?.length ?? 0) > 0 && e.sets?.every((s) => s.completed),
    );

  const [isExpanded, setIsExpanded] = useState(
    () => getCollapseState(date, rowKey) !== "collapsed",
  );
  const signature = exercises
    .map((e) => (e.sets ?? []).map((s) => (s.completed ? "1" : "0")).join(""))
    .join("|");
  const collapsedFor = useRef("");
  useEffect(() => {
    if (!shouldAutoCollapse || !isAllDone) return;
    if (collapsedFor.current === signature) return;
    collapsedFor.current = signature;
    if (getCollapseState(date, rowKey) !== "expanded") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- once, when the last set is ticked
      setIsExpanded(false);
      setCollapsed(date, rowKey, true);
    }
  }, [shouldAutoCollapse, isAllDone, signature, date, rowKey]);

  return (
    <Stack
      gap={2}
      padding={2}
      radius="lg"
      className={`border-2 ${isAllDone ? "border-success/40" : "border-accent/40"}`}
    >
      <Row gap={2} align="center">
        <div className="min-w-0 flex-1">
          <Pressable
            label={t("diary.superset.title")}
            isExpanded={isExpanded}
            onPress={() => {
              setIsExpanded(!isExpanded);
              setCollapsed(date, rowKey, isExpanded);
            }}
            align="start"
            className="w-full"
          >
            <span className="flex items-center gap-1">
              {isExpanded ? (
                <ChevronDown aria-hidden size={16} />
              ) : (
                <ChevronRight aria-hidden size={16} />
              )}
              <Link2 aria-hidden size={14} />
              <Text variant="label" as="span">
                {t("diary.superset.title")}
              </Text>
            </span>
            <Text variant="caption" tone={isAllDone ? "success" : "muted"}>
              {`${t("diary.superset.exercises", {
                count: exercises.length,
              })} · ${t("diary.card.sets", {
                done: doneCount,
                total: sets.length,
              })}`}
            </Text>
          </Pressable>
        </div>
        <Button
          size="sm"
          aria-label={t("diary.superset.remove")}
          onClick={onRemove}
        >
          <X aria-hidden size={16} />
        </Button>
      </Row>
      {isExpanded && (
        <Stack gap={2}>
          {children}
          <Row justify="center">
            <Button
              size="sm"
              text={t("diary.superset.addExercise")}
              onClick={onAddExercise}
            >
              <Plus aria-hidden size={14} />
            </Button>
          </Row>
        </Stack>
      )}
    </Stack>
  );
}
