import { Badge, SegmentedControl } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";

import { useCoachingNavigation } from "./coaching/useCoachingNavigation";
import { useShowRadioNav } from "./radio";
import {
  TRAINING_SECTIONS,
  type TrainingSectionId,
  trainingSectionOfPath,
} from "./trainingSections";

/** Sub-navigation of /training above every training screen */
export function TrainingLayout() {
  const { t } = useTranslation("training");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const coaching = useCoachingNavigation();
  const hasRadio = useShowRadioNav();
  const active = trainingSectionOfPath(pathname);

  // Coach, Coaching and Radio only appear for whom they concern, as in
  // LiftTrace; the page one is on keeps its entry.
  const isShown = (id: TrainingSectionId) => {
    if (id === "coach") return coaching.showsCoach || active === id;
    if (id === "coaching") return coaching.showsCoaching || active === id;
    if (id === "radio") return hasRadio || active === id;
    return true;
  };
  const unread: Partial<Record<TrainingSectionId, number>> = {
    coach: coaching.coachUnread,
    coaching: coaching.clientsUnread,
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 overflow-x-auto border-b border-border bg-level-0 px-4 py-2">
        <SegmentedControl<TrainingSectionId>
          variant="pill"
          aria-label={t("trainingNav.label")}
          value={active}
          options={TRAINING_SECTIONS.filter(({ id }) => isShown(id)).map(
            ({ id }) => {
              const count = unread[id] ?? 0;
              const name = t(`trainingNav.${id}`);
              return {
                value: id,
                label: (
                  <Badge
                    count={count}
                    label={t("trainingNav.unread", { count })}
                  >
                    {name}
                  </Badge>
                ),
              };
            },
          )}
          onChange={(id) => {
            const section = TRAINING_SECTIONS.find(
              (candidate) => candidate.id === id,
            );
            if (section) void navigate(section.path);
          }}
        />
      </div>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
