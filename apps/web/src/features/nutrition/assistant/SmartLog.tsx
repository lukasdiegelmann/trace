/**
 * The review of Smart Log (components/diary/SmartLogModal.svelte): what was
 * said, matched to records, to check before it goes into today's diary.
 */
import {
  Banner,
  Box,
  Button,
  Checkbox,
  Chip,
  InplaceMultiSelect,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  aiErrorText,
  loadAiSetup,
  type SmartLogProps,
} from "@/features/shared/ai";

import { AppDialog } from "../components/AppDialog";
import { DecimalField } from "../components/DecimalField";
import { useNotify } from "../components/useNotify";
import { localDateStr } from "../lib/dates";
import { amountAndUnit } from "../lib/units";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { loadAssistantSettings, mealNamesOf } from "./settings";
import {
  canLog,
  isLogged,
  matchItems,
  parseInput,
  pickCandidate,
  pickedOf,
  portionedOf,
  reviewRows,
  rowCalories,
  saveRows,
  SmartLogParseError,
  type Candidate,
  type ReviewRow,
} from "./smartLog";

type State =
  | { phase: "parsing" }
  | { phase: "failed"; message: string }
  | { phase: "review"; rows: ReviewRow[]; meal: string | null };

export function SmartLog({ text: said, onClose }: SmartLogProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const notify = useNotify();
  const [text, setText] = useState(said);
  // A new object asks the model again, also for the same text
  const [request, setRequest] = useState({ text: said });
  const [state, setState] = useState<State>({ phase: "parsing" });
  const [isSaving, setIsSaving] = useState(false);
  const mealNames = mealNamesOf(settings);

  useEffect(() => {
    const visit = new AbortController();
    const run = async (): Promise<State> => {
      const [setup, loaded] = await Promise.all([
        loadAiSetup(),
        loadAssistantSettings(),
      ]);
      visit.signal.throwIfAborted();
      const parsed = await parseInput(
        request.text,
        loaded,
        setup,
        visit.signal,
      );
      if (parsed.items.length === 0) {
        return {
          phase: "failed",
          message: t("assistant.smartLog.nothingFound"),
        };
      }
      const matches = await matchItems(parsed.items, loaded);
      return {
        phase: "review",
        meal: parsed.meal,
        rows: reviewRows(matches, parsed.meal, mealNamesOf(loaded)),
      };
    };
    run().then(
      (next) => {
        if (!visit.signal.aborted) setState(next);
      },
      (caught: unknown) => {
        if (visit.signal.aborted) return;
        setState({
          phase: "failed",
          message:
            caught instanceof SmartLogParseError
              ? t("assistant.smartLog.invalidReply")
              : aiErrorText(caught),
        });
      },
    );
    return () => {
      visit.abort();
    };
  }, [request, t]);

  const parseAgain = () => {
    if (!text.trim()) return;
    setState({ phase: "parsing" });
    setRequest({ text });
  };

  const rows = state.phase === "review" ? state.rows : [];
  const count = rows.filter(isLogged).length;

  const change = (next: ReviewRow) => {
    setState((current) =>
      current.phase === "review"
        ? {
            ...current,
            rows: current.rows.map((row) => (row.id === next.id ? next : row)),
          }
        : current,
    );
  };

  const save = async () => {
    if (isSaving || count === 0) return;
    setIsSaving(true);
    try {
      const saved = await saveRows(rows, localDateStr(), format.time);
      notify.success(t("assistant.smartLog.saved", { count: saved }));
      onClose();
    } catch (caught) {
      notify.failure(caught);
      setIsSaving(false);
    }
  };

  return (
    <AppDialog
      title={t("assistant.smartLog.title")}
      size="lg"
      onClose={onClose}
      confirmText={t("assistant.smartLog.add", { count })}
      onConfirm={save}
      isConfirmDisabled={count === 0}
      isBusy={isSaving}
    >
      <Stack gap={3}>
        <Row gap={2} align="end">
          <div className="min-w-0 flex-1">
            <Input
              label={t("assistant.smartLog.said")}
              placeholder={t("assistant.smartLog.placeholder")}
              value={text}
              onValueChange={setText}
              onEnter={parseAgain}
              fieldSize="lg"
            />
          </div>
          <Button
            size="lg"
            variant="secondary"
            text={t("assistant.smartLog.parse")}
            isDisabled={!text.trim() || state.phase === "parsing" || isSaving}
            onClick={parseAgain}
          >
            <ArrowRight aria-hidden size={16} />
          </Button>
        </Row>

        {state.phase === "parsing" && (
          <Stack align="center" padding={6}>
            <Spinner label={t("assistant.smartLog.parsing")} />
          </Stack>
        )}
        {state.phase === "failed" && <Banner text={state.message} />}
        {state.phase === "review" && (
          <>
            <Text variant="caption">
              {state.meal
                ? t("assistant.smartLog.foundWithMeal", {
                    count: rows.length,
                    meal: state.meal,
                  })
                : t("assistant.smartLog.found", { count: rows.length })}
            </Text>
            {rows.map((row) => (
              <ReviewEntry
                key={row.id}
                row={row}
                mealNames={mealNames}
                onChange={change}
              />
            ))}
          </>
        )}
      </Stack>
    </AppDialog>
  );
}

function ReviewEntry({
  row,
  mealNames,
  onChange,
}: {
  row: ReviewRow;
  mealNames: string[];
  onChange: (row: ReviewRow) => void;
}) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const candidate = pickedOf(row);

  const nameOf = (entry: Candidate): string => {
    switch (entry.type) {
      case "food":
      case "off":
        return [entry.food.name, entry.food.brand].filter(Boolean).join(" · ");
      case "meal":
      case "recipe":
        return entry.meal.name;
      case "yesterday":
        return t("assistant.smartLog.yesterdayName", {
          meal: format.mealName(mealNames[entry.slot] ?? ""),
        });
      case "water":
        return entry.containerName ?? t("assistant.smartLog.badge.water");
    }
  };
  const name = candidate ? nameOf(candidate) : row.item.name;
  const portioned = portionedOf(candidate);
  const isWater = candidate?.type === "water";
  const entries =
    candidate?.type === "meal"
      ? candidate.meal.items
      : candidate?.type === "yesterday"
        ? candidate.items
        : null;
  const calories = rowCalories(row);

  let detail: string;
  if (!candidate) detail = t("assistant.smartLog.noData");
  else if (!canLog(row)) detail = t("assistant.smartLog.offNoValues");
  else if (isWater) detail = t("assistant.smartLog.toWater");
  else if (entries) {
    detail = [
      t("assistant.smartLog.expands", { count: entries.length }),
      format.energy(calories ?? 0),
      entries.map((entry) => entry.name).join(", "),
    ].join(" · ");
  } else {
    detail = [
      format.energy(calories ?? 0),
      amountAndUnit(row.amount || "0", portioned?.unit),
    ].join(" · ");
  }

  return (
    <Box surface="surface" border="all" radius="lg" padding={3}>
      <Stack gap={2}>
        <Row gap={2} align="center" shouldWrap>
          <Checkbox
            checked={row.isIncluded && canLog(row)}
            disabled={!canLog(row)}
            aria-label={t("assistant.smartLog.include", { name })}
            onChange={(isIncluded) => {
              onChange({ ...row, isIncluded });
            }}
          />
          <Box shouldGrow>
            <Text variant="label">{name}</Text>
          </Box>
          <Chip
            text={
              candidate
                ? t(`assistant.smartLog.badge.${candidate.type}`)
                : t("assistant.smartLog.badge.notFound")
            }
            tone={candidate ? "default" : "danger"}
          />
        </Row>
        <Text variant="caption">{detail}</Text>
        {row.candidates.length > 1 && (
          <InplaceMultiSelect
            formField
            isFullWidth
            label={t("assistant.smartLog.match")}
            value={String(row.picked)}
            onChange={(value) => {
              const next = pickCandidate(row, Number(value));
              onChange({ ...next, isIncluded: canLog(next) });
            }}
            options={row.candidates.map((entry, index) => ({
              value: String(index),
              label: nameOf(entry),
            }))}
          />
        )}
        {candidate && (
          <Row gap={2} align="end" shouldWrap>
            {(portioned || isWater) && (
              <div className="w-32">
                <DecimalField
                  label={t("assistant.smartLog.amount", {
                    unit: isWater ? "ml" : portioned?.unit,
                  })}
                  value={row.amount}
                  onChange={(amount) => {
                    onChange({ ...row, amount });
                  }}
                />
              </div>
            )}
            {!isWater && (
              <div className="min-w-40 flex-1">
                <InplaceMultiSelect
                  formField
                  isFullWidth
                  label={t("assistant.card.meal")}
                  value={String(row.meal)}
                  onChange={(value) => {
                    onChange({ ...row, meal: Number(value) });
                  }}
                  options={mealNames.map((mealName, index) => ({
                    value: String(index),
                    label: format.mealName(mealName),
                  }))}
                />
              </div>
            )}
          </Row>
        )}
      </Stack>
    </Box>
  );
}
