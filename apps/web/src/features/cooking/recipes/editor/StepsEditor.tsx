import {
  Button,
  Disclosure,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ArrowDown, ArrowUp, Camera, Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ImagePicker } from "../../common/ImagePicker";
import {
  blankStep,
  moveEntry,
  type DraftGroup,
  type DraftStep,
} from "../../lib/recipeEditor";

import { FormattedField } from "./FormattedField";

export interface StepsEditorProps {
  steps: DraftStep[];
  groups: DraftGroup[];
  onChange: (steps: DraftStep[]) => void;
  onBusyChange: (isBusy: boolean) => void;
}

export function StepsEditor({
  steps,
  groups,
  onChange,
  onBusyChange,
}: StepsEditorProps) {
  const { t } = useTranslation("cooking");
  const [withPhoto, setWithPhoto] = useState<string[]>([]);
  const ingredients = groups.flatMap((group) =>
    group.items.filter((item) => item.name.trim()),
  );
  const patch = (index: number, values: Partial<DraftStep>) => {
    onChange(
      steps.map((step, i) => (i === index ? { ...step, ...values } : step)),
    );
  };

  return (
    <Stack gap={3} as="section">
      <Text variant="heading" as="h2">
        {t("recipeView.instructions")}
      </Text>
      {steps.map((step, index) => {
        const number = index + 1;
        const label = t("recipeView.step", { number });
        const linked = step.refIds.filter((id) =>
          ingredients.some((item) => item.id === id),
        ).length;
        return (
          <Stack
            key={step.key}
            gap={2}
            role="group"
            aria-label={label}
            className="rounded-container border border-border bg-level-1 p-3"
          >
            <Row justify="between" align="center" gap={2}>
              <Text variant="label">{label}</Text>
              <Row gap={0}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("recipeEditor.steps.moveUp", { number })}
                  isDisabled={index === 0}
                  onClick={() => {
                    onChange(moveEntry(steps, index, -1));
                  }}
                >
                  <ArrowUp aria-hidden size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("recipeEditor.steps.moveDown", { number })}
                  isDisabled={index === steps.length - 1}
                  onClick={() => {
                    onChange(moveEntry(steps, index, 1));
                  }}
                >
                  <ArrowDown aria-hidden size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("recipeEditor.steps.photo", { number })}
                  aria-expanded={withPhoto.includes(step.key)}
                  onClick={() => {
                    setWithPhoto((previous) =>
                      previous.includes(step.key)
                        ? previous.filter((key) => key !== step.key)
                        : [...previous, step.key],
                    );
                  }}
                >
                  <Camera aria-hidden size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("recipeEditor.steps.remove", { number })}
                  onClick={() => {
                    const left = steps.filter((_, i) => i !== index);
                    onChange(left.length ? left : [blankStep()]);
                  }}
                >
                  <Trash2 aria-hidden size={16} />
                </Button>
              </Row>
            </Row>
            <Input
              aria-label={t("recipeEditor.steps.title", { number })}
              placeholder={t("recipeEditor.steps.titlePlaceholder")}
              value={step.title}
              onValueChange={(title) => {
                patch(index, { title });
              }}
            />
            <FormattedField
              label={t("recipeEditor.steps.text", { number })}
              placeholder={t("recipeEditor.steps.textPlaceholder")}
              hint={index === 0 ? t("recipeEditor.steps.hint") : undefined}
              value={step.text}
              onChange={(text) => {
                patch(index, { text });
              }}
            />
            {withPhoto.includes(step.key) || step.imgUrl ? (
              <ImagePicker
                label={t("recipeEditor.steps.photo", { number })}
                value={step.imgUrl}
                onBusyChange={onBusyChange}
                onChange={(imgUrl) => {
                  patch(index, { imgUrl });
                }}
              />
            ) : null}
            {ingredients.length > 0 ? (
              <Disclosure
                title={
                  linked > 0
                    ? t("recipeEditor.steps.linked", { count: linked })
                    : t("recipeEditor.steps.link")
                }
                defaultOpen={step.refIds.length > 0}
              >
                <Row gap={1} shouldWrap paddingTop={2}>
                  {ingredients.map((item) => {
                    const isLinked = step.refIds.includes(item.id);
                    return (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={isLinked ? "primary" : "secondary"}
                        aria-pressed={isLinked}
                        text={item.name}
                        onClick={() => {
                          patch(index, {
                            refIds: isLinked
                              ? step.refIds.filter((id) => id !== item.id)
                              : [...step.refIds, item.id],
                          });
                        }}
                      >
                        {isLinked ? <Check aria-hidden size={14} /> : undefined}
                      </Button>
                    );
                  })}
                </Row>
              </Disclosure>
            ) : null}
          </Stack>
        );
      })}
      <Button
        className="self-start"
        variant="secondary"
        size="sm"
        text={t("recipeEditor.steps.add")}
        onClick={() => {
          onChange([...steps, blankStep()]);
        }}
      >
        <Plus aria-hidden size={14} />
      </Button>
    </Stack>
  );
}
