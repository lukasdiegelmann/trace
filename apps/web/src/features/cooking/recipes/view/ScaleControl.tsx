import {
  Input,
  Row,
  SegmentedControl,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { SCALE_FACTORS, scaledServings } from "../../lib/scale";

export interface ScaleControlProps {
  scale: number;
  onChange: (scale: number) => void;
  /** The recipe's own servings; the input shows them scaled */
  servings: number | null;
  /** The public page only has the factors */
  hasServingsInput?: boolean;
}

export function ScaleControl({
  scale,
  onChange,
  servings,
  hasServingsInput = true,
}: ScaleControlProps) {
  const { t } = useTranslation("cooking");
  if (!servings) return null;
  return (
    <Row gap={2} align="end" shouldWrap className="print:hidden">
      <SegmentedControl
        aria-label={t("recipeView.scale")}
        options={SCALE_FACTORS.map((factor) => ({
          value: factor,
          label: `×${factor.toLocaleString()}`,
        }))}
        value={scale}
        onChange={onChange}
      />
      {hasServingsInput ? (
        <div className="w-28">
          <Input
            type="number"
            min={0.25}
            step={0.25}
            label={t("recipeView.servings")}
            // Remounts on a factor, so typing isn't overwritten mid-way.
            key={SCALE_FACTORS.includes(scale) ? scale : "custom"}
            defaultValue={scaledServings(servings, scale)}
            onValueChange={(value) => {
              const next = Number(value);
              if (Number.isFinite(next) && next > 0) onChange(next / servings);
            }}
          />
        </div>
      ) : null}
    </Row>
  );
}
