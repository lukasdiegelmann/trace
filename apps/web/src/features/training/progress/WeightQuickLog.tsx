import {
  Button,
  Input,
  Row,
  useToast,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { BODY_STATS_SAVED } from "../common/events";
import { saveWeight } from "./api";

export interface WeightQuickLogProps {
  date: string;
  onSaved: () => void;
  onCancel: () => void;
}

/** One field to log a day's weight beside its photo */
export function WeightQuickLog({
  date,
  onSaved,
  onCancel,
}: WeightQuickLogProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [unit] = useSetting("lt", "weightUnit");
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const weight = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(weight) || weight <= 0) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await saveWeight(date, weight);
      toast.info(t("progress.weight.saved"));
      window.dispatchEvent(
        new CustomEvent(BODY_STATS_SAVED, { detail: { date } }),
      );
      onSaved();
    } catch (error) {
      toast.error(t("common.error", { message: (error as Error).message }));
      setIsSaving(false);
    }
  };

  return (
    <Row gap={2} align="center">
      <Input
        type="number"
        step="0.1"
        min={0}
        inputMode="decimal"
        aria-label={t("progress.weight.label")}
        placeholder={unit}
        value={value}
        onValueChange={setValue}
        onEnter={() => void save()}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onCancel();
        }}
        autoFocus
      />
      <Button
        variant="primary"
        text={t("common.save")}
        isLoading={isSaving}
        isDisabled={!value}
        onClick={() => void save()}
      />
      <Button aria-label={t("common.cancel")} onClick={onCancel}>
        <X aria-hidden size={16} />
      </Button>
    </Row>
  );
}
