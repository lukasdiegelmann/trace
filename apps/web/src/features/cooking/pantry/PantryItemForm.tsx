import {
  Button,
  DatePicker,
  Dialog,
  FileInput,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Link2, Link2Off, ScanBarcode, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/shared/settings";

import { BarcodeScanner } from "../common/BarcodeScanner";
import { ImagePicker } from "../common/ImagePicker";
import { UnitPicker } from "../common/UnitPicker";
import { useNotify } from "../common/useNotify";
import { readImage, labelFields, scanNutritionLabel } from "../lib/aiChat";
import { lookupCommonDensity } from "../lib/densityLookup";
import { offLookupBarcode } from "../lib/externalFoods";
import {
  nutrimentById,
  NUTRIMENTS,
  visibleNutrimentIds,
  type Nutriment,
} from "../lib/nutriments";
import {
  changeServingSize,
  mergeOffProduct,
  type PantryDraft,
} from "../lib/pantryForm";
import type { PantryCategory } from "../pantryApi";
import { CategoryField } from "./CategoryField";
import { NutrientFields } from "./NutrientFields";
import { OffActions } from "./OffActions";
import { useAiLabelScan } from "./useAiLabelScan";

export interface PantryItemFormProps {
  draft: PantryDraft;
  onChange: (update: (draft: PantryDraft) => PantryDraft) => void;
  categories: readonly PantryCategory[];
  onCategoryCreated: (category: PantryCategory) => void;
  /** A generic keeps expiry per variant */
  isGeneric: boolean;
  onUploadingChange: (isUploading: boolean) => void;
}

export function PantryItemForm({
  draft,
  onChange,
  categories,
  onCategoryCreated,
  isGeneric,
  onUploadingChange,
}: PantryItemFormProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { values: settings } = useSettings("ct");
  const ai = useAiLabelScan();
  const [isLinked, setIsLinked] = useState(false);
  const [servingBase, setServingBase] = useState<number | null>(
    () => Number(draft.serving_size) || null,
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAllOpen, setIsAllOpen] = useState(false);
  const [isScanningLabel, setIsScanningLabel] = useState(false);

  const set = <K extends keyof PantryDraft>(key: K, value: PantryDraft[K]) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  const inline = visibleNutrimentIds(settings.visibleNutriments)
    .map(nutrimentById)
    .filter((nutriment): nutriment is Nutriment => nutriment !== undefined);

  const lookUpDensity = () => {
    const density = lookupCommonDensity(draft.name);
    if (density === null) {
      notify.error(t("pantryItem.density.none", { name: draft.name }));
      return;
    }
    set("g_per_cup", String(density));
    notify.success(
      t("pantryItem.density.set", { value: density, name: draft.name }),
    );
  };

  const handleScan = async (code: string) => {
    setIsScannerOpen(false);
    set("barcode", code);
    if (!settings.offEnabled) return;
    const product = await offLookupBarcode(code, {
      language: settings.offSearchLanguage,
      country: settings.offSearchCountry,
    });
    if (!product) {
      notify.error(t("pantryItem.off.notFound"));
      return;
    }
    onChange((current) => mergeOffProduct(current, product));
  };

  const scanLabel = async (file: File) => {
    setIsScanningLabel(true);
    try {
      const parsed = await scanNutritionLabel(
        await readImage(file),
        ai.config,
        ai.shouldUseProxy,
      );
      if (!parsed) {
        notify.error(t("pantryItem.label.unreadable"));
        return;
      }
      // The label wins over what the form held.
      const fields = labelFields(parsed);
      onChange((current) => ({
        ...current,
        name: fields.name ?? current.name,
        brand: fields.brand ?? current.brand,
        serving_size:
          fields.serving_size === undefined
            ? current.serving_size
            : String(fields.serving_size),
        serving_unit: fields.serving_unit ?? current.serving_unit,
        nutrition: { ...current.nutrition, ...fields.nutrition },
      }));
      if (fields.serving_size !== undefined) {
        setServingBase(fields.serving_size);
      }
      notify.success(t("pantryItem.label.done"));
    } catch (error) {
      const reason =
        error instanceof Error && error.message === "missing-api-key"
          ? t("pantryItem.label.noKey")
          : error instanceof Error && error.message === "missing-base-url"
            ? t("pantryItem.label.noBaseUrl")
            : error instanceof Error
              ? error.message
              : "";
      notify.error(t("pantryItem.label.failed", { reason }));
    } finally {
      setIsScanningLabel(false);
    }
  };

  return (
    <Stack gap={4}>
      <ImagePicker
        label={t("pantryItem.fields.photo")}
        value={draft.img_url}
        onChange={(url) => {
          set("img_url", url);
        }}
        onBusyChange={onUploadingChange}
      />
      <Input
        label={t("pantryItem.fields.name")}
        placeholder={t("pantryItem.placeholders.name")}
        value={draft.name}
        onChange={(event) => {
          set("name", event.target.value);
        }}
      />
      <Input
        label={t("pantryItem.fields.brand")}
        placeholder={t("pantryItem.placeholders.brand")}
        value={draft.brand}
        onChange={(event) => {
          set("brand", event.target.value);
        }}
      />
      <CategoryField
        categories={categories}
        categoryId={draft.category_id}
        slug={draft.category}
        onChange={({ id, slug }) => {
          onChange((current) => ({
            ...current,
            category_id: id,
            category: slug,
          }));
        }}
        onCreated={onCategoryCreated}
      />
      <Row gap={2} align="end">
        <Input
          label={t("pantryItem.fields.barcode")}
          inputMode="numeric"
          value={draft.barcode}
          wrapperClassName="min-w-0 flex-1"
          onChange={(event) => {
            set("barcode", event.target.value);
          }}
        />
        <Button
          variant="secondary"
          size="md"
          aria-label={t("cookingCommon.barcode.title")}
          onClick={() => {
            setIsScannerOpen(true);
          }}
        >
          <ScanBarcode aria-hidden size={18} />
        </Button>
      </Row>
      {settings.offEnabled && draft.barcode.trim() ? (
        <OffActions draft={draft} onMerge={onChange} />
      ) : null}

      <Row gap={2} align="end" shouldWrap>
        <Input
          label={t("pantryItem.fields.onHand")}
          inputMode="decimal"
          value={draft.quantity}
          wrapperClassName="min-w-24 flex-1"
          onChange={(event) => {
            set("quantity", event.target.value);
          }}
        />
        <div className="min-w-40 flex-1">
          <UnitPicker
            label={t("pantryItem.fields.unit")}
            value={draft.unit}
            onChange={(unit) => {
              set("unit", unit);
            }}
          />
        </div>
      </Row>
      <Text variant="caption" tone="muted">
        {t("pantryItem.stockHint")}
      </Text>

      <Row gap={2} align="end" shouldWrap>
        <Input
          label={t("pantryItem.fields.servingSize")}
          inputMode="decimal"
          value={draft.serving_size}
          wrapperClassName="min-w-24 flex-1"
          onChange={(event) => {
            const change = changeServingSize(
              draft,
              event.target.value,
              isLinked,
              servingBase,
            );
            setServingBase(change.base);
            onChange(() => change.draft);
          }}
        />
        <div className="min-w-40 flex-1">
          <UnitPicker
            label={t("pantryItem.fields.servingUnit")}
            value={draft.serving_unit}
            placeholder="g"
            onChange={(unit) => {
              set("serving_unit", unit);
            }}
          />
        </div>
        <Button
          size="md"
          variant={isLinked ? "primary" : "secondary"}
          aria-pressed={isLinked}
          aria-label={t(isLinked ? "pantryItem.linked" : "pantryItem.unlinked")}
          onClick={() => {
            setIsLinked(!isLinked);
          }}
        >
          {isLinked ? (
            <Link2 aria-hidden size={18} />
          ) : (
            <Link2Off aria-hidden size={18} />
          )}
        </Button>
      </Row>
      <Row gap={2} align="end">
        <Input
          label={t("pantryItem.fields.density")}
          placeholder={t("pantryItem.placeholders.density")}
          inputMode="decimal"
          value={draft.g_per_cup}
          wrapperClassName="min-w-0 flex-1"
          onChange={(event) => {
            set("g_per_cup", event.target.value);
          }}
        />
        <Button
          variant="secondary"
          size="md"
          text={t("pantryItem.density.lookUp")}
          isDisabled={!draft.name.trim()}
          onClick={lookUpDensity}
        >
          <Sparkles aria-hidden size={14} />
        </Button>
      </Row>

      {isGeneric ? (
        <Text tone="muted">{t("pantryItem.expiryPerVariant")}</Text>
      ) : (
        <DatePicker
          label={t("pantryItem.fields.expiresOn")}
          placeholder={t("pantryItem.placeholders.expiresOn")}
          value={draft.expires_on || null}
          clearable
          onChange={(date) => {
            set("expires_on", date ?? "");
          }}
        />
      )}
      <Input
        multiline
        rows={3}
        label={t("pantryItem.fields.notes")}
        placeholder={t("pantryItem.placeholders.notes")}
        value={draft.notes}
        onChange={(event) => {
          set("notes", event.target.value);
        }}
      />

      <Stack gap={2}>
        <Text variant="heading" as="h3">
          {t("pantryItem.nutrition.title")}
        </Text>
        <Text variant="caption" tone="muted">
          {t("pantryItem.nutrition.perServing")}
        </Text>
        {ai.isAvailable ? (
          isScanningLabel ? (
            <Text role="status">{t("pantryItem.label.scanning")}</Text>
          ) : (
            <FileInput
              accept="image/*"
              capture="environment"
              text={t("pantryItem.label.scan")}
              captureText={t("pantryItem.label.photo")}
              placeholder={t("cookingCommon.photo.noFile")}
              file={null}
              onChange={(file) => {
                if (file) void scanLabel(file);
              }}
            />
          )
        ) : null}
        <NutrientFields
          nutriments={inline}
          nutrition={draft.nutrition}
          onChange={(nutrition) => {
            set("nutrition", nutrition);
          }}
        />
        <Button
          size="md"
          variant="secondary"
          text={t("pantryItem.nutrition.editAll")}
          onClick={() => {
            setIsAllOpen(true);
          }}
        />
      </Stack>

      {isAllOpen ? (
        <Dialog
          open
          size="lg"
          onOpenChange={setIsAllOpen}
          title={t("pantryItem.nutrition.allTitle")}
          description={t("pantryItem.nutrition.allHint")}
          cancelText={t("cookingCommon.done")}
        >
          <NutrientFields
            nutriments={NUTRIMENTS}
            nutrition={draft.nutrition}
            onChange={(nutrition) => {
              set("nutrition", nutrition);
            }}
          />
        </Dialog>
      ) : null}
      {isScannerOpen ? (
        <BarcodeScanner
          onClose={() => {
            setIsScannerOpen(false);
          }}
          onScan={(code) => void handleScan(code)}
        />
      ) : null}
    </Stack>
  );
}
