import {
  Button,
  Checkbox,
  Chip,
  Input,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronLeft, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { activityApi, type ActivityRow, type ActivityWrite } from "../api";
import { AppDialog } from "../components/AppDialog";
import { DecimalField } from "../components/DecimalField";
import {
  activityHistory,
  groupedByCategory,
  metKcal,
  searchCompendium,
  type ActivityCategory,
  type CompendiumActivity,
} from "../lib/activity";
import { addDays } from "../lib/dates";
import { parseDecimal, toInputValue } from "../lib/decimal";
import { displayEnergy, energyInputToKcal, round1 } from "../lib/nutrition";
import { includesFolded } from "../lib/searchText";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { useResource } from "../useResource";
import { useActivityWeight } from "./useActivityWeight";

interface Suggestion {
  key: string;
  name: string;
  detail: string;
  pick: () => void;
}

export function ActivityDialog({
  date,
  activity,
  onSave,
  onClose,
}: {
  date: string;
  /** The entry being edited; none when adding */
  activity?: ActivityRow;
  onSave: (write: ActivityWrite) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const weightKg = useActivityWeight();

  const [name, setName] = useState(activity?.name ?? "");
  const [met, setMet] = useState<number | null>(activity?.met ?? null);
  const [duration, setDuration] = useState(
    toInputValue(activity?.duration_min),
  );
  const [distance, setDistance] = useState(activity?.distance ?? "");
  const [typedEnergy, setTypedEnergy] = useState<string | null>(
    activity ? String(displayEnergy(activity.kcal, format.energyUnit)) : null,
  );
  const [isTemplate, setIsTemplate] = useState(Boolean(activity?.is_template));
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  // Counts compendium picks, to move on to the duration after each
  const [picks, setPicks] = useState(0);

  const history = useResource("activity-history", async () =>
    activityHistory(await activityApi.range(addDays(date, -90), date)),
  );

  const estimate = metKcal({
    met,
    weightKg,
    durationMin: parseDecimal(duration),
  });
  // The estimate fills the field until the user types a value of their own
  const energy =
    typedEnergy ??
    (estimate === null
      ? ""
      : String(displayEnergy(estimate, format.energyUnit)));

  const pickCompendium = (entry: CompendiumActivity) => {
    setName(entry.name);
    setMet(entry.met);
    setIsSuggesting(false);
    setIsBrowsing(false);
    setPicks((count) => count + 1);
  };

  const query = name.trim();
  const templates = (history.data?.templates ?? []).filter(
    (row) => !query || includesFolded(row.name, query),
  );
  const past = query
    ? (history.data?.past ?? [])
        .filter((row) => !row.is_template && includesFolded(row.name, query))
        .slice(0, 4)
    : [];
  const groups: { title: string; entries: Suggestion[] }[] = [
    {
      title: t("diary.activity.templates"),
      entries: templates.map((row) => ({
        key: `t${row.id}`,
        name: row.name,
        detail: format.energy(row.kcal),
        pick: () => {
          setName(row.name);
          setMet(row.met);
          setDuration(toInputValue(row.duration_min));
          setDistance(row.distance ?? "");
          if (row.met === null) {
            setTypedEnergy(String(displayEnergy(row.kcal, format.energyUnit)));
          }
          setIsSuggesting(false);
        },
      })),
    },
    {
      title: t("diary.activity.past"),
      entries: past.map((row) => ({
        key: `p${row.id}`,
        name: row.name,
        detail: format.energy(row.kcal),
        pick: () => {
          setName(row.name);
          setMet(null);
          setIsSuggesting(false);
        },
      })),
    },
    {
      title: t("diary.activity.compendium"),
      entries: searchCompendium(query)
        .slice(0, 8)
        .map((entry) => ({
          key: entry.id,
          name: entry.name,
          detail: t("diary.activity.met", { met: entry.met }),
          pick: () => {
            pickCompendium(entry);
          },
        })),
    },
  ].filter((group) => group.entries.length > 0);

  const save = async () => {
    if (isBusy) return;
    if (!name.trim()) {
      setError(t("diary.activity.nameRequired"));
      return;
    }
    const typed = parseDecimal(energy);
    const kcal = Number.isFinite(typed)
      ? Math.round(
          typedEnergy === null && estimate !== null
            ? estimate
            : energyInputToKcal(typed, format.energyUnit),
        )
      : 0;
    if (kcal <= 0) {
      setError(t("diary.activity.energyRequired"));
      return;
    }
    const minutes = parseDecimal(duration);
    setIsBusy(true);
    const isSaved = await onSave({
      date,
      name: name.trim().slice(0, 80),
      kcal,
      duration_min:
        Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null,
      distance: distance.trim() || null,
      source: met !== null ? "compendium" : (activity?.source ?? "manual_form"),
      met,
      is_template: isTemplate,
    });
    if (isSaved) onClose();
    else setIsBusy(false);
  };

  return (
    <AppDialog
      title={t(
        activity ? "diary.activity.editTitle" : "diary.activity.addTitle",
      )}
      onClose={onClose}
      confirmText={t(
        activity ? "diary.activity.saveAction" : "diary.activity.addAction",
      )}
      isBusy={isBusy}
      onConfirm={isBrowsing ? undefined : save}
    >
      {isBrowsing ? (
        <CategoryBrowser
          onPick={pickCompendium}
          onBack={() => {
            setIsBrowsing(false);
          }}
        />
      ) : (
        <Stack gap={3}>
          <Row gap={2} align="end">
            <div className="min-w-0 flex-1">
              <Input
                label={t("diary.activity.name")}
                value={name}
                maxLength={80}
                autoFocus={!activity}
                fieldSize="lg"
                onValueChange={(value) => {
                  setName(value);
                  setMet(null);
                  setIsSuggesting(true);
                }}
                onFocus={() => {
                  setIsSuggesting(true);
                }}
                onEnter={() => void save()}
              />
            </div>
            <Button
              variant="secondary"
              size="lg"
              aria-label={t("diary.activity.browse")}
              onClick={() => {
                setIsBrowsing(true);
              }}
            >
              <Search aria-hidden size={18} />
            </Button>
          </Row>
          {isSuggesting && groups.length > 0 && (
            <Stack gap={1}>
              {groups.map((group) => (
                <Stack gap={0} key={group.title}>
                  <Text variant="label">{group.title}</Text>
                  {group.entries.map((entry) => (
                    <Pressable
                      key={entry.key}
                      onPress={entry.pick}
                      paddingY={1}
                      fill="width"
                    >
                      <Row gap={2} justify="between">
                        <Text variant="small" isTruncated>
                          {entry.name}
                        </Text>
                        <Text variant="caption">{entry.detail}</Text>
                      </Row>
                    </Pressable>
                  ))}
                </Stack>
              ))}
            </Stack>
          )}
          {met !== null && (
            <Row>
              <Chip text={t("diary.activity.met", { met })} />
            </Row>
          )}
          <DecimalField
            key={picks}
            hasAutoFocus={picks > 0}
            label={t("diary.activity.duration")}
            value={duration}
            onChange={(value) => {
              setDuration(value);
              setIsSuggesting(false);
            }}
            onEnter={() => void save()}
          />
          <Input
            label={t("diary.activity.distance")}
            placeholder={t("diary.activity.distancePlaceholder", {
              unit: settings.distUnit,
            })}
            maxLength={40}
            value={distance}
            onValueChange={setDistance}
            onEnter={() => void save()}
            fieldSize="lg"
          />
          <DecimalField
            label={t("diary.activity.energy", { unit: format.energyUnit })}
            value={energy}
            onChange={setTypedEnergy}
            onEnter={() => void save()}
          />
          {met !== null && (
            <Text variant="caption">
              {weightKg === null
                ? t("diary.activity.noWeight")
                : estimate !== null &&
                  t("diary.activity.formula", {
                    met,
                    weight: format.number(round1(weightKg)),
                    minutes: duration,
                    energy: format.energy(estimate),
                  })}
            </Text>
          )}
          <Checkbox
            checked={isTemplate}
            onChange={setIsTemplate}
            label={t("diary.activity.template")}
          />
          {error && (
            <Text variant="small" tone="danger" role="alert">
              {error}
            </Text>
          )}
        </Stack>
      )}
    </AppDialog>
  );
}

/** Compendium by category, or searched across all of them */
function CategoryBrowser({
  onPick,
  onBack,
}: {
  onPick: (activity: CompendiumActivity) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const groups = groupedByCategory();
  const categoryName = (id: string) =>
    t(`diary.activity.categories.${id as ActivityCategory}`);
  const results = query.trim()
    ? searchCompendium(query).slice(0, 40)
    : (groups.find((group) => group.category === category)?.activities ?? []);
  const isListing = query.trim() !== "" || category !== null;

  return (
    <Stack gap={2}>
      <Row>
        <Button
          size="sm"
          text={t(category ? "diary.activity.back" : "common.close")}
          onClick={() => {
            if (category) setCategory(null);
            else onBack();
          }}
        >
          <ChevronLeft aria-hidden size={16} />
        </Button>
      </Row>
      <Input
        aria-label={t("diary.activity.searchActivities")}
        placeholder={t("diary.activity.searchActivities")}
        value={query}
        onValueChange={setQuery}
        fieldSize="lg"
      />
      {!isListing &&
        groups.map((group) => (
          <Pressable
            key={group.category}
            onPress={() => {
              setCategory(group.category);
            }}
            paddingY={2}
            fill="width"
          >
            <Row gap={2} justify="between">
              <Text>{categoryName(group.category)}</Text>
              <Text variant="caption">{group.activities.length}</Text>
            </Row>
          </Pressable>
        ))}
      {isListing && results.length === 0 && (
        <Text tone="muted">{t("diary.activity.noResults")}</Text>
      )}
      {isListing &&
        results.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => {
              onPick(entry);
            }}
            paddingY={2}
            fill="width"
          >
            <Row gap={2} justify="between">
              <Stack gap={0} shouldGrow>
                <Text variant="small">{entry.name}</Text>
                {query.trim() !== "" && (
                  <Text variant="caption">{categoryName(entry.category)}</Text>
                )}
              </Stack>
              <Text variant="caption">
                {t("diary.activity.met", { met: entry.met })}
              </Text>
            </Row>
          </Pressable>
        ))}
    </Stack>
  );
}
