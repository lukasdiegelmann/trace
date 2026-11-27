import { Banner, Stack } from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { api } from "@/api";
import { useSettings } from "@/features/shared/settings";
import { useThemePreference } from "@/theme/theme";

import { useLoad } from "./common/useLoad";
import { stringList } from "./lib/lists";

const STORAGE_KEY = "trace.settings.onboardingDismissed";

const CARDS = [
  { id: "appearance", to: "/settings/appearance" },
  { id: "goals", to: "/nutrition/goals" },
  { id: "wellness", to: "/nutrition/wellness/settings" },
  { id: "program", to: "/training/programs" },
  { id: "assistant", to: "/settings/assistant" },
] as const;

type CardId = (typeof CARDS)[number]["id"];

function readDismissed(): string[] {
  try {
    return stringList(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

/** What isn't set up yet, as dismissible hints (the old apps' cards) */
export function OnboardingCards() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(readDismissed);
  const nt = useSettings("nt");
  const theme = useThemePreference();
  const programs = useLoad(
    () => api.lt.get<{ is_active?: number | boolean }[]>("/programs"),
    [],
  );

  const goals = nt.values.goals as Record<string, unknown> | null;
  const isOpen: Record<CardId, boolean> = {
    appearance: theme === "system",
    goals: nt.status === "ready" && !goals?.calories,
    wellness: nt.status === "ready" && !nt.values.wellnessEnabled,
    program:
      Array.isArray(programs.data) &&
      !programs.data.some((program) => program.is_active),
    assistant: nt.status === "ready" && !nt.values.aiEnabled,
  };
  const shown = CARDS.filter(
    (card) => isOpen[card.id] && !dismissed.includes(card.id),
  );
  if (shown.length === 0) return null;

  const dismiss = (id: CardId) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode: dismissed for this page only.
    }
  };

  return (
    <Stack gap={2}>
      {shown.map((card) => (
        <Banner
          key={card.id}
          text={t(`home.cards.${card.id}`)}
          actionText={t(`home.cards.${card.id}Action`)}
          onAction={() => void navigate(card.to)}
          dismissText={t("home.cards.dismiss")}
          onDismiss={() => {
            dismiss(card.id);
          }}
        />
      ))}
    </Stack>
  );
}
