import {
  Button,
  Checkbox,
  Chip,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { confidenceOf, isSelectable } from "../../lib/importing";

import type { Batch, BatchItem } from "./importApi";

export interface BatchPickerProps {
  batch: Batch;
  selected: ReadonlySet<string>;
  onChange: (selected: Set<string>) => void;
  /** Rows the AI already saved, by id */
  savedByAi?: ReadonlyMap<string, string>;
  /** Offered for rows the parser was unsure about */
  onTryAi?: (item: BatchItem) => void;
  isAiBusy?: boolean;
  /** Scraped URLs have no confidence to select by */
  isScraped?: boolean;
}

export function BatchPicker({
  batch,
  selected,
  onChange,
  savedByAi,
  onTryAi,
  isAiBusy,
  isScraped,
}: BatchPickerProps) {
  const { t } = useTranslation("cooking");
  const threshold = batch.highConfidenceThreshold;
  const pickable = batch.items.filter(
    (item) => isSelectable(item) && !savedByAi?.has(item.id),
  );
  const clean = pickable.filter((item) => item.confidence >= threshold);
  const skipped = batch.items.filter((item) => !isSelectable(item)).length;
  const select = (items: BatchItem[]) => {
    onChange(new Set(items.map((item) => item.id)));
  };

  return (
    <Stack gap={3}>
      <Text variant="small" tone="muted">
        {isScraped
          ? t("importers.batch.scrapedSummary", {
              ok: batch.items.length - skipped,
              failed: skipped,
              selected: selected.size,
            })
          : t("importers.batch.summary", {
              clean: clean.length,
              partial: pickable.length - clean.length,
              skipped,
              selected: selected.size,
            })}
      </Text>
      <Row gap={1} shouldWrap>
        <Button
          variant="ghost"
          size="sm"
          text={t("importers.batch.selectAll")}
          onClick={() => {
            select(pickable);
          }}
        />
        {isScraped ? null : (
          <Button
            variant="ghost"
            size="sm"
            text={t("importers.batch.selectClean")}
            onClick={() => {
              select(clean);
            }}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          text={t("cookingCommon.clear")}
          onClick={() => {
            select([]);
          }}
        />
      </Row>
      <Stack gap={2} as="ul">
        {batch.items.map((item) => {
          const aiName = savedByAi?.get(item.id);
          const name =
            item.name || item.url || item.filename || t("importers.untitled");
          const counts = t("importers.batch.counts", {
            ingredients: item.ingredientCount ?? 0,
            steps: item.stepCount ?? 0,
          });
          const grade = confidenceOf(item.confidence, threshold);
          const status = aiName
            ? t("importers.batch.savedByAi")
            : item.error
              ? t("importers.batch.failed")
              : item.empty
                ? t("importers.batch.noText")
                : isScraped
                  ? t("importers.batch.scraped", {
                      tier: item.tier || "standard",
                    })
                  : `${t(`importers.confidence.${grade}`)} (${Math.round(item.confidence * 100)}%)`;
          const detail = item.error || (item.empty ? item.hint : counts);
          const origin = isScraped
            ? item.url
            : item.filename === name
              ? ""
              : [item.source, item.filename].filter(Boolean).join(" → ");
          return (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-container border border-border p-2"
            >
              <Checkbox
                checked={selected.has(item.id)}
                disabled={!isSelectable(item) || Boolean(aiName)}
                label={name}
                onChange={(isChecked) => {
                  const next = new Set(selected);
                  if (isChecked) next.add(item.id);
                  else next.delete(item.id);
                  onChange(next);
                }}
              />
              <Row gap={2} align="center" shouldWrap>
                <Chip
                  tone={
                    item.error
                      ? "danger"
                      : aiName || grade === "clean"
                        ? "accent"
                        : "default"
                  }
                  text={status}
                />
                {detail ? (
                  <Text variant="caption" tone="muted">
                    {detail}
                  </Text>
                ) : null}
                {onTryAi &&
                !aiName &&
                isSelectable(item) &&
                item.confidence < threshold ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    text={t("importers.tryAi")}
                    isDisabled={isAiBusy}
                    onClick={() => {
                      onTryAi(item);
                    }}
                  >
                    <Sparkles aria-hidden size={14} />
                  </Button>
                ) : null}
              </Row>
              {origin ? (
                <Text variant="caption" tone="muted" isTruncated>
                  {origin}
                </Text>
              ) : null}
            </li>
          );
        })}
      </Stack>
    </Stack>
  );
}
