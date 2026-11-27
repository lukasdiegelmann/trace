import {
  Button,
  Input,
  Island,
  KeyValue,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Maximize2, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { BODY_STATS_SAVED } from "../common/events";
import {
  bodyStatUnit,
  hasBodyStatValue,
  parseBodyStatsResponse,
  parseWeightInput,
  widgetMeasurementRows,
  type BodyStatValues,
} from "../lib/bodyStats";
import { bodyStatsApi } from "./cardioBodyApi";
import { useLtSettings } from "./ltSettings";

export interface BodyStatsWidgetProps {
  date: string;
  onOpen: () => void;
}

export function BodyStatsWidget(props: BodyStatsWidgetProps) {
  return <BodyStatsWidgetContent key={props.date} {...props} />;
}

/** The overview's weight and measurements of the day */
function BodyStatsWidgetContent({ date, onOpen }: BodyStatsWidgetProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const { weightUnit, bodyStatsVisible } = useLtSettings();
  const [stats, setStats] = useState<BodyStatValues>({});
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    bodyStatsApi
      .get(date)
      .then((data) => {
        setStats(parseBodyStatsResponse(data));
      })
      .catch(() => {
        setStats({});
      });
  }, [date]);

  useEffect(() => {
    load();
    window.addEventListener(BODY_STATS_SAVED, load);
    return () => {
      window.removeEventListener(BODY_STATS_SAVED, load);
    };
  }, [load]);

  const commit = async () => {
    const weight = parseWeightInput((draft ?? "").replace(",", "."));
    if (weight === null) {
      setDraft(null);
      return;
    }
    setIsSaving(true);
    try {
      const next = { ...stats, weight };
      await bodyStatsApi.save(date, next);
      setStats(next);
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("bodyStats.saveFailed"),
      );
    }
    setIsSaving(false);
  };

  const rows = widgetMeasurementRows(stats, bodyStatsVisible);

  return (
    <Island
      title={t("bodyStats.title")}
      actions={
        <Button
          size="sm"
          aria-label={t("bodyStats.widget.openSheet")}
          onClick={onOpen}
        >
          <Maximize2 aria-hidden size={14} />
        </Button>
      }
    >
      <Stack gap={2}>
        {draft !== null ? (
          <Row gap={1} align="end">
            <Input
              autoFocus
              inputMode="decimal"
              aria-label={t("bodyStats.widget.weightInput", {
                unit: weightUnit,
              })}
              value={draft}
              onValueChange={setDraft}
              onEnter={() => void commit()}
              onKeyDown={(event) => {
                if (event.key === "Escape") setDraft(null);
              }}
              onFocus={(event) => {
                event.target.select();
              }}
            />
            <Button
              size="sm"
              variant="primary"
              text={
                isSaving
                  ? t("bodyStats.widget.savingShort")
                  : t("bodyStats.widget.save")
              }
              isDisabled={isSaving}
              onClick={() => void commit()}
            />
            <Button
              size="sm"
              text={t("bodyStats.widget.cancel")}
              onClick={() => {
                setDraft(null);
              }}
            />
          </Row>
        ) : hasBodyStatValue(stats.weight) ? (
          <Row gap={2} align="center" justify="between">
            <Text variant="title">{`${String(stats.weight)} ${weightUnit}`}</Text>
            <Button
              size="sm"
              aria-label={t("bodyStats.widget.editWeight")}
              onClick={() => {
                setDraft(String(stats.weight));
              }}
            >
              <Pencil aria-hidden size={14} />
            </Button>
          </Row>
        ) : (
          <Row gap={2} align="center" justify="between">
            <Text variant="small" tone="muted">
              {t("bodyStats.widget.weightNotLogged")}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              text={t("bodyStats.widget.log")}
              onClick={() => {
                setDraft("");
              }}
            />
          </Row>
        )}
        {rows.length ? (
          rows.map((row) => (
            <KeyValue
              key={row.id}
              label={t(`bodyStats.stats.${row.id}`)}
              value={`${row.value} ${bodyStatUnit(row.id, weightUnit)}`}
            />
          ))
        ) : (
          <Text variant="caption" tone="muted">
            {t("bodyStats.widget.noMeasurements")}
          </Text>
        )}
        <Button
          size="sm"
          variant="secondary"
          isFullWidth
          text={t("bodyStats.widget.logStats")}
          onClick={onOpen}
        />
      </Stack>
    </Island>
  );
}
