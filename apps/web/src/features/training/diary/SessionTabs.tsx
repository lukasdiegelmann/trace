import { Button, Row } from "@monocircuit/monolithium/components";
import { CircleCheck, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { WorkoutLog } from "../lib/workoutTypes";

export interface SessionTabsProps {
  sessions: WorkoutLog[];
  sessionId: number | null;
  onSwitch: (id: number) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

/** Shown once a day has more than one workout (issue #76) */
export function SessionTabs({
  sessions,
  sessionId,
  onSwitch,
  onDelete,
  onAdd,
}: SessionTabsProps) {
  const { t } = useTranslation("training");
  if (sessions.length < 2) return null;
  return (
    // TODO(monolithium): tabs with a close action per tab
    <Row gap={2} shouldWrap role="group" aria-label={t("diary.sessions.label")}>
      {sessions.map((session) => {
        const id = session.id;
        if (id == null) return null;
        const name = session.name || t("diary.workoutFallback");
        const isShown = id === sessionId;
        return (
          <Row key={id} gap={0} align="center">
            <Button
              size="sm"
              variant={isShown ? "primary" : "secondary"}
              text={name}
              aria-pressed={isShown}
              aria-label={
                session.completed
                  ? `${name}, ${t("diary.sessions.completed")}`
                  : name
              }
              onClick={() => {
                if (!isShown) onSwitch(id);
              }}
            >
              {session.completed ? (
                <CircleCheck aria-hidden size={14} />
              ) : undefined}
            </Button>
            <Button
              size="sm"
              aria-label={t("diary.sessions.delete", { name })}
              onClick={() => {
                onDelete(id);
              }}
            >
              <X aria-hidden size={14} />
            </Button>
          </Row>
        );
      })}
      <Button size="sm" aria-label={t("diary.sessions.add")} onClick={onAdd}>
        <Plus aria-hidden size={14} />
      </Button>
    </Row>
  );
}
