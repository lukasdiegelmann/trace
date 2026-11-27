import {
  Box,
  Button,
  ExternalLink,
  Meter,
  Row,
  SegmentedControl,
  Stack,
  Stat,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronUp, CircleHelp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { AdaptiveTdee } from "../api";
import { useNtSettings, type NtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

type Mode = NtSettings["calorieGoalMode"];

/** How the calorie goal comes about, and the factor for the two that learn */
export function CalorieModeCard() {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const navigate = useNavigate();
  const [isDynamicRefused, setDynamicRefused] = useState(false);
  const hasWearable =
    settings.fitbitEnabled ||
    settings.googleHealthEnabled ||
    settings.healthConnectEnabled ||
    settings.garminEnabled;
  const mode = settings.calorieGoalMode;

  return (
    <Box surface="surface" border="all" radius="lg" padding={4}>
      <Stack gap={3}>
        <Text variant="heading" as="h2">
          {t("goals.mode.label")}
        </Text>
        <SegmentedControl<Mode>
          aria-label={t("goals.mode.label")}
          options={(["fixed", "dynamic", "adaptive"] as const).map((id) => ({
            value: id,
            label: t(`goals.mode.${id}`),
          }))}
          value={mode}
          onChange={(next) => {
            // Without a wearable there is nothing to be dynamic about
            if (next === "dynamic" && !hasWearable) {
              setDynamicRefused(true);
              return;
            }
            setDynamicRefused(false);
            set("calorieGoalMode", next);
          }}
        />
        <Text variant="caption">{t(`goals.mode.${mode}Text`)}</Text>
        {mode === "adaptive" && (
          <ExternalLink
            href="https://github.com/TraceApps/nutritrace#adaptive-tdee"
            text={t("goals.mode.adaptiveDocs")}
          />
        )}
        {isDynamicRefused && (
          <Row gap={2} align="center" shouldWrap>
            <Text variant="small" tone="warning" role="status">
              {t("goals.mode.needsWearable")}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              text={t("goals.mode.toSettings")}
              onClick={() => void navigate("/nutrition/wellness/settings")}
            />
          </Row>
        )}
        {mode !== "fixed" && (
          <SegmentedControl<number>
            aria-label={t("goals.factor.label")}
            options={[
              { value: 0.8, label: t("goals.factor.lose") },
              { value: 1, label: t("goals.factor.maintain") },
              { value: 1.2, label: t("goals.factor.gain") },
            ]}
            value={settings.calorieGoalFactor}
            onChange={(factor) => {
              set("calorieGoalFactor", factor);
            }}
          />
        )}
      </Stack>
    </Box>
  );
}

/** How far the adaptive estimate is, and what it learned */
export function AdaptiveCard({
  adaptive,
  hasFailed,
  goalKcal,
  fixedKcal,
}: {
  adaptive: AdaptiveTdee | null;
  hasFailed: boolean;
  goalKcal: number;
  fixedKcal: number;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isReady = Boolean(adaptive?.ready) && adaptive?.tdee != null;
  const available = adaptive?.daysAvailable ?? 0;
  const required = adaptive?.daysRequired ?? 21;
  const isPounds = settings.weightUnit === "lb";
  const trendKg = adaptive?.trendKgPerWeek ?? 0;
  const trend = isPounds ? trendKg * 2.20462 : trendKg;

  return (
    <Box surface="surface" border="all" radius="lg" padding={4}>
      <Stack gap={3}>
        <Row gap={2} align="center" justify="between">
          <Text variant="heading" as="h2">
            {t("goals.adaptive.title")}
          </Text>
          <Button
            size="sm"
            aria-label={t("goals.adaptive.help")}
            aria-expanded={isHelpOpen}
            onClick={() => {
              setIsHelpOpen(!isHelpOpen);
            }}
          >
            {isHelpOpen ? (
              <ChevronUp aria-hidden size={16} />
            ) : (
              <CircleHelp aria-hidden size={16} />
            )}
          </Button>
        </Row>
        {hasFailed ? (
          <Text tone="danger" role="alert">
            {t("goals.adaptive.failed")}
          </Text>
        ) : !adaptive ? (
          <Text tone="muted">{t("common.loading")}</Text>
        ) : isReady ? (
          <>
            <Text>
              {t("goals.adaptive.learned", {
                energy: format.energy(adaptive.tdee ?? 0),
                trend: `${trend > 0 ? "+" : ""}${format.number(trend, 2)}`,
                unit: isPounds ? "lb" : "kg",
              })}
            </Text>
            <div className="grid grid-cols-3 gap-2 compact:grid-cols-1">
              <Stat
                label={t("goals.adaptive.todayGoal")}
                value={format.energy(goalKcal)}
              />
              <Stat
                label={t("goals.adaptive.confidence")}
                value={`${Math.round((adaptive.confidence ?? 0) * 100)}%`}
              />
              <Stat
                label={t("goals.adaptive.weightSource")}
                value={
                  adaptive.weightSource
                    ? t(`goals.adaptive.source.${adaptive.weightSource}`)
                    : "—"
                }
              />
            </div>
          </>
        ) : (
          <>
            <Meter
              label={t("goals.adaptive.building", { available, required })}
              value={Math.min(available, required)}
              max={Math.max(1, required)}
            />
            <Text variant="caption">
              {t("goals.adaptive.untilReady", {
                energy: format.energy(fixedKcal),
              })}
            </Text>
          </>
        )}
        {isHelpOpen && (
          <Stack gap={2}>
            {(
              [
                "helpIntro",
                "helpIntake",
                "helpWeight",
                "helpTrend",
                "helpTips",
                "helpCaveats",
              ] as const
            ).map((key) => (
              <Text key={key} variant="small">
                {t(`goals.adaptive.${key}`)}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
