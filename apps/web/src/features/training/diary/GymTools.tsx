import {
  Chip,
  Input,
  Island,
  Row,
  SegmentedControl,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  BAR_WEIGHT,
  calcPlates,
  convertWeight,
  countPlates,
  plateHeight,
  type ConvertDirection,
  type WeightUnit,
} from "../lib/plates";
import { useDiaryFormats } from "./format";

/** Tailwind colours telling the plates apart, heaviest first */
const PLATE_CLASSES = [
  "bg-destructive",
  "bg-accent",
  "bg-warning",
  "bg-success",
  "bg-fg/60",
  "bg-fg/40",
  "bg-fg/25",
];

function PlateCalculator({ unit }: { unit: WeightUnit }) {
  const { t } = useTranslation("training");
  const { number } = useDiaryFormats();
  const [target, setTarget] = useState("");
  const load = calcPlates(target.replace(",", "."), unit);
  const counts = countPlates(load.perSide);
  return (
    <Stack gap={3}>
      <Input
        label={t("gymTools.target", { unit })}
        placeholder={t("gymTools.targetPlaceholder", {
          example: unit === "kg" ? 100 : 225,
        })}
        inputMode="decimal"
        value={target}
        onValueChange={setTarget}
      />
      <Text variant="caption" tone="muted">
        {t("gymTools.bar", { bar: BAR_WEIGHT[unit], unit })}
      </Text>
      {load.perSide.length > 0 ? (
        <>
          <Text variant="label">{t("gymTools.eachSide")}</Text>
          {/* TODO(monolithium): a plate stack visual; plain bars until then */}
          <div className="flex items-center gap-0.5" aria-hidden>
            <div className="h-1.5 w-8 rounded-full bg-fg/30" />
            {load.perSide.map((plate, i) => (
              <div
                key={i}
                className={`w-3 rounded-inner ${
                  PLATE_CLASSES[
                    counts.findIndex((c) => c.plate === plate) %
                      PLATE_CLASSES.length
                  ] ?? ""
                }`}
                style={{ height: plateHeight(plate, unit) }}
              />
            ))}
          </div>
          <Row gap={2} shouldWrap>
            {counts.map(({ plate, count }) => (
              <Chip
                key={plate}
                text={t("gymTools.plateCount", {
                  count,
                  plate: number(plate, 2),
                  unit,
                })}
              />
            ))}
          </Row>
        </>
      ) : (
        target !== "" && (
          <Text variant="small" tone="muted">
            {t("gymTools.belowBar", { bar: BAR_WEIGHT[unit], unit })}
          </Text>
        )
      )}
      {load.perSide.length > 0 && load.remainder > 0.01 && (
        <Text variant="small" tone="warning">
          {t("gymTools.remainder", {
            remainder: number(load.remainder, 2),
            unit,
          })}
        </Text>
      )}
    </Stack>
  );
}

function Converter() {
  const { t } = useTranslation("training");
  const { number } = useDiaryFormats();
  const [direction, setDirection] = useState<ConvertDirection>("lbsToKg");
  const [input, setInput] = useState("");
  return (
    <Stack gap={3}>
      <SegmentedControl<ConvertDirection>
        aria-label={t("gymTools.direction")}
        value={direction}
        onChange={setDirection}
        options={[
          { value: "lbsToKg", label: t("gymTools.lbsToKg") },
          { value: "kgToLbs", label: t("gymTools.kgToLbs") },
        ]}
      />
      <Input
        label={
          direction === "lbsToKg"
            ? t("gymTools.pounds")
            : t("gymTools.kilograms")
        }
        placeholder={t("gymTools.enterWeight")}
        inputMode="decimal"
        value={input}
        onValueChange={setInput}
      />
      {input !== "" && (
        <Text variant="title" aria-live="polite">
          {t("gymTools.result", {
            value: number(convertWeight(input.replace(",", "."), direction), 2),
            unit: direction === "lbsToKg" ? "kg" : "lbs",
          })}
        </Text>
      )}
    </Stack>
  );
}

function GymToolsContent({ unit }: { unit: WeightUnit }) {
  const { t } = useTranslation("training");
  const [tab, setTab] = useState<"plates" | "convert">("plates");
  return (
    <Stack gap={3}>
      <SegmentedControl<"plates" | "convert">
        aria-label={t("gymTools.tabs")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "plates", label: t("gymTools.plates") },
          { value: "convert", label: t("gymTools.convert") },
        ]}
      />
      {tab === "plates" ? <PlateCalculator unit={unit} /> : <Converter />}
    </Stack>
  );
}

/** Plate calculator and unit converter, inline in the overview */
export function GymToolsPanel({ unit }: { unit: WeightUnit }) {
  const { t } = useTranslation("training");
  return (
    <Island title={t("gymTools.title")}>
      <GymToolsContent unit={unit} />
    </Island>
  );
}

export function GymToolsSheet({
  isOpen,
  onOpenChange,
  unit,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  unit: WeightUnit;
}) {
  const { t } = useTranslation("training");
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("gymTools.title")}
    >
      <GymToolsContent unit={unit} />
    </Sheet>
  );
}
