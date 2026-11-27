import { Checkbox, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../../lib/assetUrl";
import { linkedIngredients } from "../../lib/linkedIngredients";
import type { IngredientGroup, RecipeStep } from "../../recipesApi";

import { Amount } from "./IngredientsSection";
import { StepText } from "./StepText";

export interface StepsSectionProps {
  steps: RecipeStep[];
  groups: IngredientGroup[];
  onTimer: (index: number, durationSec: number) => void;
  /** Set while cooking: steps and their ingredients can be ticked off */
  cooking?: {
    steps: number[];
    ingredients: string[];
    onStep: (index: number, linkedKeys: string[]) => void;
    onIngredient: (key: string) => void;
  };
  /** The public page shows neither photos nor linked ingredients */
  isPublic?: boolean;
}

export function StepsSection({
  steps,
  groups,
  onTimer,
  cooking,
  isPublic,
}: StepsSectionProps) {
  const { t } = useTranslation("cooking");
  return (
    <Stack gap={3} as="section">
      <Text variant="heading" as="h2">
        {t("recipeView.instructions")}
      </Text>
      {steps.length === 0 ? (
        <Text tone="muted">{t("recipeView.noSteps")}</Text>
      ) : null}
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const links = isPublic ? [] : linkedIngredients(groups, step.refIds);
          const isDone = cooking?.steps.includes(index) ?? false;
          const label = t("recipeView.step", { number: index + 1 });
          return (
            <li
              key={index}
              id={`step-${index}`}
              className={`rounded-container border border-border bg-level-1 p-3 transition-colors ${
                isDone ? "opacity-60" : ""
              }`}
            >
              <Stack gap={2}>
                {cooking ? (
                  <Checkbox
                    checked={isDone}
                    label={label}
                    onChange={() => {
                      cooking.onStep(
                        index,
                        links.map((link) => link.key),
                      );
                    }}
                  />
                ) : (
                  <Text variant="label" tone="muted">
                    {label}
                  </Text>
                )}
                {step.title ? (
                  <Text variant="heading" as="h3">
                    {step.title}
                  </Text>
                ) : null}
                {links.length > 0 ? (
                  <ul className="flex flex-col gap-1 border-l-2 border-border pl-3">
                    {links.map(({ item, key }) => {
                      const line = (
                        <span
                          className={
                            cooking?.ingredients.includes(key)
                              ? "line-through opacity-55"
                              : ""
                          }
                        >
                          <Amount item={item} scale={1} /> {item.name}
                        </span>
                      );
                      return (
                        <li key={key} className="text-body">
                          {cooking ? (
                            <Checkbox
                              checked={cooking.ingredients.includes(key)}
                              label={line}
                              onChange={() => {
                                cooking.onIngredient(key);
                              }}
                            />
                          ) : (
                            line
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {!isPublic && step.imgUrl && assetUrl(step.imgUrl) ? (
                  <img
                    src={assetUrl(step.imgUrl)}
                    alt={label}
                    loading="lazy"
                    className="max-h-96 w-full rounded-container object-cover print:hidden"
                  />
                ) : null}
                <div
                  className={cooking ? "text-lg leading-relaxed" : "text-body"}
                >
                  <StepText
                    text={step.text ?? ""}
                    onTimer={(durationSec) => {
                      onTimer(index, durationSec);
                    }}
                  />
                </div>
              </Stack>
            </li>
          );
        })}
      </ol>
    </Stack>
  );
}
