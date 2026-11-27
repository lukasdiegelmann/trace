import {
  Box,
  Button,
  EmptyState,
  Input,
  Row,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
  Tile,
} from "@monocircuit/monolithium/components";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { AppDialog } from "../components/AppDialog";
import { useConfirm } from "../components/confirm";
import { DecimalField } from "../components/DecimalField";
import { MacroBar, MacroStats } from "../components/Macros";
import { useNotify } from "../components/useNotify";
import { useDayGoal } from "../diary/useDayGoal";
import { parseDecimal } from "../lib/decimal";
import { calorieGoal } from "../lib/dayGoals";
import { parseIsoDate } from "../lib/dates";
import {
  applyMacroPreset,
  currentPreset,
  GOAL_BODY_STATS,
  goalStorageId,
  goalWarnings,
  isBodyStatGoal,
  MACRO_PRESET_IDS,
  macroKcal,
  macroShares,
  macroTargets,
  migrateKilojoulesGoal,
  nutrientGoalIds,
  rowTarget,
  WELLNESS_GOALS,
} from "../lib/goals";
import { KJ_PER_KCAL } from "../lib/nutrition";
import { includesFolded } from "../lib/searchText";
import { trendPath } from "../lib/trendLink";
import { displayToMl, mlToDisplay, waterUnitLabel } from "../lib/water";
import { useNtSettings } from "../settings";
import { useIsWide } from "../useIsWide";
import { useNutritionFormat } from "../useNutritionFormat";
import { useResource } from "../useResource";
import { wellnessApi } from "../api";
import { AdaptiveCard, CalorieModeCard } from "./CalorieMode";
import { GoalEditorDialog } from "./GoalEditorDialog";
import { GoalRow } from "./GoalRow";
import { Templates } from "./Templates";
import { useGoalsData } from "./useGoalsData";
import { useGoalStats } from "./useGoalStats";

type TabId = "yours" | "all" | "templates";

const MACRO_IDS = new Set(["proteins", "carbohydrates", "fat"]);
const MACRO_CELLS = [
  ["protein", "proteins"],
  ["carbs", "carbohydrates"],
  ["fat", "fat"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <Box surface="surface" border="all" radius="lg" paddingY={3}>
        <Stack gap={1}>
          <Box paddingX={3}>
            <Text variant="heading" as="h2">
              {title}
            </Text>
          </Box>
          <ul className="m-0 flex flex-col p-0">{children}</ul>
        </Stack>
      </Box>
    </section>
  );
}

export function GoalsPage() {
  const { isLoaded } = useNtSettings();
  const { t } = useTranslation("nutrition");
  if (!isLoaded) {
    return (
      <Stack align="center" padding={6}>
        <Spinner label={t("common.loading")} />
      </Stack>
    );
  }
  return <Goals />;
}

function Goals() {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const format = useNutritionFormat();
  const stats = useGoalStats();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const notify = useNotify();
  const isWide = useIsWide();
  const data = useGoalsData();
  const dayGoal = useDayGoal(data.today);
  // The readiness card shows progress in every mode it is asked in
  const adaptive = useResource(
    settings.calorieGoalMode === "adaptive" ? "goals-adaptive" : null,
    () => wellnessApi.adaptiveTdee(),
  );
  const [tab, setTab] = useState<TabId>("yours");
  const [editing, setEditing] = useState<string | null>(null);
  const [water, setWater] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // An old kilojoules goal becomes a calorie goal once
  const { goals } = settings;
  useEffect(() => {
    if (goals.kilojoules) set("goals", migrateKilojoulesGoal(goals));
  }, [goals, set]);

  const { today } = data;
  const calGoal = dayGoal.goal.kcal;
  const fixedKcal = calorieGoal({
    goals,
    date: today,
    mode: "fixed",
    factor: 1,
    caloriesOut: null,
    adaptive: null,
  }).kcal;
  const targets = macroTargets(goals, today, calGoal);
  const shares = macroShares(targets);
  const preset = currentPreset(shares);
  const macroSum = macroKcal(targets);
  const unit = settings.waterUnit;
  const waterTarget = settings.waterGoalMl;

  const nutrients = nutrientGoalIds(settings.energyUnit);
  const wellnessIds = settings.wellnessEnabled
    ? WELLNESS_GOALS.map((goal) => goal.id as string)
    : [];
  const isConfigured = (id: string) => Boolean(goals[goalStorageId(id)]);
  const hasAnyGoal = [...GOAL_BODY_STATS, ...nutrients, ...wellnessIds].some(
    (id) => isConfigured(id),
  );

  const showTrend = (id: string) => {
    const path = trendPath(id);
    return path ? () => void navigate(path) : undefined;
  };

  const row = (id: string, isInAll: boolean) => {
    const isEnergy = id === "calories" || id === "kilojoules";
    const source = dayGoal.goal.source;
    const isKjRow =
      id === "kilojoules" ||
      (id === "calories_out" && settings.energyUnit === "kJ");
    let target = rowTarget(goals, id, today, calGoal, settings.energyUnit);
    if (isEnergy && source !== "fixed" && !isInAll) {
      target =
        id === "kilojoules" ? Math.round(calGoal * KJ_PER_KCAL) : calGoal;
    }
    const reading = data.current(id === "kilojoules" ? "calories" : id);
    const current =
      reading === null
        ? null
        : isKjRow
          ? reading.value * KJ_PER_KCAL
          : reading.value;
    return (
      <GoalRow
        key={id}
        name={stats.name(id)}
        marker={
          isEnergy && source !== "fixed"
            ? t(
                source === "dynamic"
                  ? "goals.row.dynamicMarker"
                  : "goals.row.adaptiveMarker",
              )
            : undefined
        }
        unit={stats.unit(id)}
        current={current}
        target={target}
        isMin={goals[goalStorageId(id)]?.isMin}
        asOf={
          isBodyStatGoal(id) && reading?.date
            ? t("goals.row.asOf", {
                date: parseIsoDate(reading.date).toLocaleDateString(
                  format.locale,
                  { month: "short", day: "numeric" },
                ),
              })
            : null
        }
        hasGoal={!isInAll || isConfigured(id)}
        canWarn={!isInAll && !wellnessIds.includes(id)}
        onPress={() => {
          setEditing(id);
        }}
        onShowTrend={showTrend(id === "kilojoules" ? "calories" : id)}
        isMarked={isInAll && target !== null}
      />
    );
  };

  const waterRow = (
    <GoalRow
      name={t("goals.row.waterGoal")}
      unit={waterUnitLabel(unit)}
      current={mlToDisplay(data.waterMl, unit)}
      target={mlToDisplay(waterTarget, unit)}
      isMin
      onPress={() => {
        setWater(String(mlToDisplay(waterTarget, unit)));
      }}
      onShowTrend={showTrend("water")}
    />
  );

  const matching = (ids: string[]) =>
    ids.filter((id) => !filter || includesFolded(stats.name(id), filter));
  const section = (title: string, ids: string[], isInAll: boolean) =>
    ids.length > 0 && (
      <Section title={title}>{ids.map((id) => row(id, isInAll))}</Section>
    );

  const saveWater = () => {
    if (water === null) return;
    const value = parseDecimal(water);
    set(
      "waterGoalMl",
      displayToMl(Number.isFinite(value) ? Math.max(0, value) : 0, unit),
    );
    setWater(null);
    notify.success(t("goals.toast.waterSaved"));
  };

  const yours = (
    <Stack gap={3}>
      <Box surface="surface" border="all" radius="lg" padding={4}>
        <Stack gap={3}>
          <Text variant="heading" as="h2">
            {t("goals.sections.macros")}
          </Text>
          <div className="grid grid-cols-3 gap-2">
            {MACRO_CELLS.map(([key, id]) => (
              <Tile
                key={key}
                onPress={() => {
                  setEditing(id);
                }}
                label={t("goals.row.edit", { name: t(`macros.${key}`) })}
              >
                <Stack gap={0} align="center">
                  <Text variant="caption">{t(`macros.${key}`)}</Text>
                  <Text variant="heading">
                    {targets[key] === null
                      ? "—"
                      : `${format.number(targets[key], 0)} g`}
                  </Text>
                  <Text variant="caption">{`${shares[key]}%`}</Text>
                </Stack>
              </Tile>
            ))}
          </div>
          <Row
            gap={1}
            shouldWrap
            role="group"
            aria-label={t("goals.presets.label")}
          >
            {MACRO_PRESET_IDS.map((id) => (
              <Button
                key={id}
                size="sm"
                variant="secondary"
                aria-pressed={preset === id}
                isActive={preset === id}
                text={t(`goals.presets.${id}`)}
                onClick={() => {
                  set("goals", applyMacroPreset(goals, id, fixedKcal));
                  notify.success(t("goals.presets.applied"));
                }}
              />
            ))}
          </Row>
          {preset && (
            <Text
              variant="caption"
              title={preset === "custom" ? undefined : t("goals.presets.hint")}
            >
              {t("goals.presets.current", {
                preset: t(`goals.presets.${preset}`),
              })}
            </Text>
          )}
        </Stack>
      </Box>
      {!hasAnyGoal && (
        <Stack gap={1} align="center">
          <EmptyState text={t("goals.empty.title")} />
          <Text variant="caption">{t("goals.empty.hint")}</Text>
        </Stack>
      )}
      {section(
        t("goals.sections.body"),
        GOAL_BODY_STATS.filter(isConfigured),
        false,
      )}
      {section(
        t("goals.sections.nutrients"),
        nutrients.filter((id) => !MACRO_IDS.has(id) && isConfigured(id)),
        false,
      )}
      <Section title={t("goals.sections.water")}>{waterRow}</Section>
      {section(
        t("goals.sections.wellness"),
        wellnessIds.filter(isConfigured),
        false,
      )}
      <Button
        variant="danger"
        size="md"
        text={t("goals.reset.action")}
        isDisabled={Object.keys(goals).length === 0}
        onClick={() => {
          void confirm({
            title: t("goals.reset.title"),
            description: t("goals.reset.text"),
            confirmText: t("goals.reset.action"),
            isDangerous: true,
          }).then((isConfirmed) => {
            if (!isConfirmed) return;
            set("goals", {});
            notify.success(t("goals.reset.done"));
          });
        }}
      />
    </Stack>
  );

  const all = (
    <Stack gap={3}>
      <Text variant="small" tone="muted">
        {t("goals.all.intro")}
      </Text>
      <Input
        type="search"
        aria-label={t("goals.all.filter")}
        placeholder={t("goals.all.filter")}
        value={filter}
        onValueChange={setFilter}
        fieldSize="lg"
      />
      {section(t("goals.sections.body"), matching([...GOAL_BODY_STATS]), true)}
      {section(t("goals.sections.nutrients"), matching(nutrients), true)}
      <Section title={t("goals.sections.water")}>{waterRow}</Section>
      {section(t("goals.sections.wellness"), matching(wellnessIds), true)}
    </Stack>
  );

  const preview = (
    <aside aria-label={t("goals.preview.title")}>
      <Box surface="surface" border="all" radius="lg" padding={4}>
        <Stack gap={3}>
          <Text variant="heading" as="h2">
            {t("goals.preview.title")}
          </Text>
          <MacroStats
            kcal={calGoal}
            grams={{
              protein: targets.protein ?? 0,
              carbs: targets.carbs ?? 0,
              fat: targets.fat ?? 0,
            }}
          />
          <MacroBar
            size="md"
            grams={{
              protein: targets.protein ?? 0,
              carbs: targets.carbs ?? 0,
              fat: targets.fat ?? 0,
            }}
          />
          <Text variant="small">
            {t("goals.preview.sum", {
              protein: format.number(targets.protein ?? 0, 0),
              carbs: format.number(targets.carbs ?? 0, 0),
              fat: format.number(targets.fat ?? 0, 0),
              energy: format.energy(macroSum),
            })}
          </Text>
          <Stack gap={1}>
            {goalWarnings(calGoal, macroSum).map((warning) => (
              <Text
                key={warning.kind}
                variant="small"
                tone={
                  warning.kind === "tooLow" || warning.kind === "tooHigh"
                    ? "warning"
                    : "muted"
                }
              >
                {t(`goals.preview.${warning.kind}`, {
                  energy: format.energy(calGoal),
                  minimum: format.energy(1200),
                  macros:
                    warning.kind === "mismatch"
                      ? format.energy(warning.macroKcal)
                      : "",
                })}
              </Text>
            ))}
          </Stack>
        </Stack>
      </Box>
    </aside>
  );

  return (
    <div
      className={
        isWide
          ? "grid grid-cols-[minmax(0,1fr)_22.5rem] items-start gap-4 p-4"
          : "flex flex-col gap-3 p-4"
      }
    >
      <Stack gap={3}>
        <CalorieModeCard />
        {settings.calorieGoalMode === "adaptive" && tab === "yours" && (
          <AdaptiveCard
            adaptive={adaptive.data}
            hasFailed={adaptive.error !== null}
            goalKcal={calGoal}
            fixedKcal={fixedKcal}
          />
        )}
        <SegmentedControl<TabId>
          aria-label={t("goals.tabs.label")}
          options={(["yours", "all", "templates"] as const).map((id) => ({
            value: id,
            label: t(`goals.tabs.${id}`),
          }))}
          value={tab}
          onChange={setTab}
        />
        {tab === "yours" ? (
          yours
        ) : tab === "all" ? (
          all
        ) : (
          <Templates
            onApplied={() => {
              setTab("yours");
            }}
          />
        )}
      </Stack>
      {isWide && preview}
      {editing && (
        <GoalEditorDialog
          statId={editing}
          calGoalKcal={calGoal}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      {water !== null && (
        <AppDialog
          title={t("goals.row.waterGoal")}
          onClose={() => {
            setWater(null);
          }}
          onConfirm={saveWater}
        >
          <DecimalField
            label={t("goals.editor.waterLabel", {
              unit: waterUnitLabel(unit),
            })}
            value={water}
            onChange={setWater}
            onEnter={saveWater}
            hasAutoFocus
          />
        </AppDialog>
      )}
    </div>
  );
}
