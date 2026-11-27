import {
  Banner,
  FloatingNavigator,
  Spinner,
  Stack,
} from "@monocircuit/monolithium/components";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";

import { BACKEND_IDS } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { SignInPage } from "@/auth/SignInPage";
import { Assistant } from "@/features/assistant/Assistant";
import { cookingToolset } from "@/features/cooking/assistant";
import { CookOverlays } from "@/features/cooking/timers/CookOverlays";
import { nutritionToolset } from "@/features/nutrition/assistant";
import { OnboardingGate } from "@/features/settings/account/OnboardingGate";
import { UpdateWatch } from "@/features/settings/system/UpdateWatch";
import { trainingToolset } from "@/features/training/assistant";
import { coachingStore } from "@/features/training/coaching/coachingStore";
import { TrainingTimerBars } from "@/features/training/diary/TimerBars";
import {
  RadioMiniPlayer,
  stopRadio,
  usePlayer,
} from "@/features/training/radio";

import { navigatorEntries, SECTIONS, sectionOfPath } from "./navigation";

const TOOLSETS = [nutritionToolset, cookingToolset, trainingToolset];

/** Its own component: the player's updates redraw only the assistant */
function ShellAssistant() {
  const isPlaying = usePlayer("isPlaying");
  return <Assistant toolsets={TOOLSETS} isMusicPlaying={isPlaying} />;
}

/**
 * The frame of every signed-in page. The navigation is a pill that floats over
 * it: at the top of wide screens, at the bottom of phones (`compact`, below
 * 48rem). What lies under it gets 5rem to scroll clear (monolithium's README,
 * "Floating navigation"). On a phone that room is below the dock of the timer
 * bars and the player while one of them shows, else at the end of the page.
 */
export function AppShell() {
  const { t } = useTranslation();
  const { sessions, signedOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const entries = useMemo(() => navigatorEntries(t), [t]);
  const activeId = sectionOfPath(pathname);
  const isSignedOut = signedOut.length > 0;

  // Without a session the radio stops and coaching is forgotten.
  useEffect(() => {
    if (!isSignedOut) return;
    stopRadio();
    coachingStore.reset();
  }, [isSignedOut]);

  if (!sessions) {
    return (
      <Stack fill="both" align="center" justify="center">
        <Spinner size="lg" label={t("app.loading")} />
      </Stack>
    );
  }
  if (signedOut.length > 0) return <SignInPage />;

  const unavailable = BACKEND_IDS.filter(
    (backend) => sessions[backend].state === "unavailable",
  );

  const select = (id: string) => {
    const section = SECTIONS.find((candidate) => candidate.id === id);
    if (section) void navigate(section.path);
  };

  return (
    <div className="relative flex h-full flex-col print:block print:h-auto">
      {/* First, so the keyboard reaches it first, and everything that floats
          on the same layer (the assistant, the cook timers) lies above it.
          The wrapper is unpositioned: it only keeps the bar off paper. */}
      <div className="print:hidden">
        <FloatingNavigator
          aria-label={t("nav.label")}
          entries={entries}
          activeId={activeId}
          onSelect={select}
          placement="bottom-when-compact"
          shape="pill"
          isExpanded
        />
      </div>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-level-0 pt-[calc(5rem+env(safe-area-inset-top))] compact:pt-0 compact:[&:has(+[data-shell-dock]:empty)]:pb-[calc(5rem+env(safe-area-inset-bottom))] print:overflow-visible print:p-0!">
        {unavailable.map((backend) => (
          <Banner
            key={backend}
            className="print:hidden"
            text={t("offline.unavailable", {
              backend: t(`backends.${backend}`),
            })}
          />
        ))}
        <UpdateWatch />
        <Outlet />
      </main>
      {/* Must stay right after main and render nothing while idle: main
          looks at whether it is empty */}
      <div
        data-shell-dock
        className="shrink-0 compact:pb-[calc(5rem+env(safe-area-inset-bottom))] compact:empty:hidden print:hidden"
      >
        {/* LiftTrace's rest and hold timers run on while one moves around */}
        <TrainingTimerBars />
        {/* LiftTrace's player plays on while one moves around the app */}
        <RadioMiniPlayer />
      </div>
      <OnboardingGate />
      <CookOverlays />
      <ShellAssistant />
    </div>
  );
}
