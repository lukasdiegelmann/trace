import {
  Box,
  Button,
  Meter,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Footprints, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ActivityRow, ActivitySum } from "../api";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { ItemRow } from "./ItemRow";

const SEGMENT_COLORS = [
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-outgoing)",
  "var(--color-incoming)",
  "var(--color-waiting)",
];

export function ActivitySection({
  rows,
  sum,
  onAdd,
  onEdit,
  onDelete,
}: {
  rows: ActivityRow[];
  sum: ActivitySum | null;
  onAdd: () => void;
  onEdit: (row: ActivityRow) => void;
  onDelete: (row: ActivityRow) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const total = rows.reduce((value, row) => value + row.kcal, 0);
  const isIgnored =
    (sum?.wearable ?? 0) > 0 &&
    settings.manualActivityPolicy === "wearable_wins";

  const meta = (row: ActivityRow) => {
    const parts: string[] = [];
    if (row.duration_min) {
      parts.push(t("diary.activity.minutes", { count: row.duration_min }));
    }
    if (row.distance) {
      parts.push(
        /^\d+([.,]\d+)?$/.test(row.distance.trim())
          ? `${row.distance.trim()} ${settings.distUnit}`
          : row.distance,
      );
    }
    parts.push(`−${format.energy(row.kcal)}`);
    if (row.source === "ai_estimated") {
      parts.push(t("diary.activity.estimated"));
    }
    return parts.join(" · ");
  };

  return (
    <section aria-label={t("diary.activity.title")}>
      <Box surface="surface" border="all" radius="lg" paddingY={2}>
        <Row gap={2} align="center" paddingX={3}>
          <Footprints aria-hidden size={18} />
          <Stack gap={0} shouldGrow>
            <Text variant="heading" as="h2">
              {t("diary.activity.title")}
            </Text>
            {settings.wellnessEnabled && (
              <Text variant="caption">{t("diary.activity.wellnessHint")}</Text>
            )}
          </Stack>
          <Button
            size="sm"
            aria-label={t("diary.activity.add")}
            onClick={onAdd}
          >
            <Plus aria-hidden size={18} />
          </Button>
        </Row>
        {rows.map((row) => (
          <ItemRow
            key={row.id}
            name={row.name}
            meta={meta(row)}
            onPress={() => {
              onEdit(row);
            }}
            actions={[
              {
                id: "edit",
                text: t("common.edit"),
                onSelect: () => {
                  onEdit(row);
                },
              },
              {
                id: "delete",
                text: t("common.delete"),
                tone: "danger",
                onSelect: () => {
                  onDelete(row);
                },
              },
            ]}
          />
        ))}
        <Pressable onPress={onAdd} paddingX={3} paddingY={2} fill="width">
          <Text variant="small" tone="muted">
            {t(
              rows.length === 0
                ? "diary.activity.tapToAdd"
                : "diary.activity.add",
            )}
          </Text>
        </Pressable>
        {rows.length > 0 && (
          <Box paddingX={3}>
            <Meter
              max={null}
              size="sm"
              ariaLabel={t("diary.activity.title")}
              segments={rows.map((row, index) => ({
                value: row.kcal,
                color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                label: row.name,
              }))}
              valueText={`−${format.energy(total)}${
                isIgnored ? ` · ${t("diary.activity.notCounted")}` : ""
              }`}
              label={t("diary.activity.title")}
            />
          </Box>
        )}
      </Box>
    </section>
  );
}
