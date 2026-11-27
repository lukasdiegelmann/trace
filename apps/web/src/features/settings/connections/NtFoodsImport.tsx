/** CookTrace's "Import foods from NutriTrace" (SettingsImportFromNT.svelte) */
import {
  Button,
  Checkbox,
  EmptyState,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Utensils } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";

import { SegmentRow, SelectRow, SwitchRow, TextRow } from "../common/fields";
import { useAction } from "../common/useAction";
import { backendAssetUrl } from "../lib/assets";
import { genericParents, type PantryRow } from "../lib/pantryParents";

interface NtFood {
  id: number;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  img_url?: string | null;
  image_url?: string | null;
  nutrition?: { calories?: number | null } | null;
}

interface ImportAnswer {
  count: number;
  skipped?: { name: string; reason: string }[];
}

type VariantMode = "flat" | "variant-of-existing" | "variant-of-new";

/** The food's picture from NutriTrace, a fork and knife where there is none */
function Thumb({ url }: { url: string | null | undefined }) {
  const [isBroken, setIsBroken] = useState(false);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-container bg-level-1">
      {url && !isBroken ? (
        <img
          src={backendAssetUrl("nt", url)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => {
            setIsBroken(true);
          }}
        />
      ) : (
        <Utensils aria-hidden size={16} />
      )}
    </span>
  );
}

export function NtFoodsImport() {
  const { t } = useTranslation("settings");
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<NtFood[] | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [mode, setMode] = useState<VariantMode>("flat");
  const [parents, setParents] = useState<{ id: number; label: string }[]>([]);
  const [parentId, setParentId] = useState(0);
  const [genericName, setGenericName] = useState("");
  const [isInStock, setIsInStock] = useState(true);
  const [result, setResult] = useState<ImportAnswer | null>(null);
  const { isBusy, run } = useAction();

  const search = (text: string) =>
    run(async () => {
      setResult(null);
      setPicked(new Set());
      setFoods(await api.ct.get<NtFood[]>("/nt/foods", { query: { q: text } }));
    });

  const pickMode = (next: VariantMode) => {
    setMode(next);
    if (next === "variant-of-existing") {
      void run(async () => {
        const rows = await api.ct.get<PantryRow[]>("/pantry");
        setParents(genericParents(rows, t("connections.generic")));
      });
    }
  };

  const toggle = (id: number, isOn: boolean) => {
    const next = new Set(picked);
    if (isOn) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const isReady =
    picked.size > 0 &&
    (mode !== "variant-of-existing" || parentId > 0) &&
    (mode !== "variant-of-new" || genericName.trim() !== "");

  const submit = () =>
    run(async () => {
      const answer = await api.ct.post<ImportAnswer>("/nt/import-foods", {
        foods: (foods ?? []).filter((food) => picked.has(food.id)),
        inStock: isInStock,
        variantMode: mode,
        parentId: mode === "variant-of-existing" ? parentId : null,
        newGenericName: mode === "variant-of-new" ? genericName.trim() : null,
      });
      setResult(answer);
      setFoods(null);
      setPicked(new Set());
    });

  return (
    <Stack gap={3}>
      <TextRow
        label={t("connections.searchNt")}
        value={query}
        isLive
        onCommit={setQuery}
        onSubmit={() => {
          if (!isBusy) void search(query);
        }}
      />
      <Row>
        <Button
          variant="secondary"
          size="sm"
          text={t("connections.search")}
          isLoading={isBusy}
          onClick={() => void search(query)}
        />
      </Row>
      {foods?.length === 0 ? (
        <EmptyState text={t("connections.noFoods")} />
      ) : null}
      {foods?.length ? (
        <>
          <Row gap={2} align="center" shouldWrap>
            <Text variant="small">
              {t("connections.selected", { count: picked.size })}
            </Text>
            <Button
              variant="ghost"
              size="sm"
              text={t("actions.selectAll")}
              onClick={() => {
                setPicked(new Set(foods.map((food) => food.id)));
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              text={t("actions.selectNone")}
              onClick={() => {
                setPicked(new Set());
              }}
            />
          </Row>
          {foods.map((food) => (
            <Row key={food.id} gap={2} align="center">
              <Thumb url={food.image_url || food.img_url} />
              <Checkbox
                label={[
                  food.name,
                  food.brand,
                  food.barcode,
                  food.nutrition?.calories != null
                    ? `${Math.round(food.nutrition.calories)} kcal`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                checked={picked.has(food.id)}
                onChange={(isOn) => {
                  toggle(food.id, isOn);
                }}
              />
            </Row>
          ))}
          <SegmentRow<VariantMode>
            label={t("connections.variantMode")}
            value={mode}
            options={(
              ["flat", "variant-of-existing", "variant-of-new"] as const
            ).map((value) => ({
              value,
              label: t(`connections.variants.${value}`),
            }))}
            onChange={pickMode}
          />
          {mode === "variant-of-existing" ? (
            <SelectRow<number>
              label={t("connections.parent")}
              value={parentId}
              options={parents.map((parent) => ({
                value: parent.id,
                label: parent.label,
              }))}
              onChange={setParentId}
            />
          ) : null}
          {mode === "variant-of-new" ? (
            <TextRow
              label={t("connections.genericName")}
              value={genericName}
              isLive
              onCommit={setGenericName}
            />
          ) : null}
          <SwitchRow
            label={t("connections.inStock")}
            isChecked={isInStock}
            onChange={setIsInStock}
          />
          <Row gap={2}>
            <Button
              variant="primary"
              size="md"
              text={t("connections.importSelected")}
              isDisabled={!isReady}
              isLoading={isBusy}
              onClick={() => void submit()}
            />
            <Button
              variant="ghost"
              size="md"
              text={t("actions.cancel")}
              onClick={() => {
                setFoods(null);
                setPicked(new Set());
              }}
            />
          </Row>
        </>
      ) : null}
      {result ? (
        <Stack gap={1} role="status">
          <Text tone="success">
            {t("connections.importedFoods", { count: result.count })}
          </Text>
          {result.skipped?.map((skip) => (
            <Text key={skip.name} variant="small" tone="muted">
              {`${skip.name}: ${skip.reason}`}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
