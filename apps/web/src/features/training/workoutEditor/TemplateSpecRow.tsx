/**
 * One row of a template exercise's per-set targets, ported from LiftTrace
 * `components/programs/TemplateSpecRow.svelte`.
 */
import {
  Button,
  Input,
  Menu,
  Row,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { Flame, Link2, Unlink2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { splitPatch } from "../lib/templateEdit";
import {
  fmtSetDuration,
  maskDurationInput,
  parseDuration,
} from "../lib/workout";
import type { LoadType, SetSpec, SetType } from "../lib/workoutTypes";

const ROUND_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];
const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export interface TemplateSpecRowProps {
  spec: SetSpec;
  setIdx: number;
  loadType: LoadType;
  setType: SetType;
  /** The trackRpe setting */
  hasRpe: boolean;
  /** In supersets: a round number can be assigned */
  hasNumberPicker: boolean;
  isReadOnly: boolean;
  onChange: (patch: Partial<SetSpec>) => void;
  /** null clears the override */
  onNumberChange: (number: number | null) => void;
  onRemove: () => void;
}

export function TemplateSpecRow({
  spec,
  setIdx,
  loadType,
  setType,
  hasRpe,
  hasNumberPicker,
  isReadOnly,
  onChange,
  onNumberChange,
  onRemove,
}: TemplateSpecRowProps) {
  const { t } = useTranslation("training");
  const [isNumberOpen, setIsNumberOpen] = useState(false);
  const [isRpeOpen, setIsRpeOpen] = useState(false);

  const set = setIdx + 1;
  const displayNumber = spec.number ?? set;
  const isTimed = setType === "time";
  const isSplit =
    !isTimed &&
    loadType === "unilateral" &&
    (spec.reps_l != null || spec.reps_r != null);

  const numberItems: MenuItem[] = ROUND_VALUES.map((number) => ({
    id: String(number),
    text: t("workoutEditor.spec.round", { number }),
    isChecked: displayNumber === number,
    onSelect: () => {
      onNumberChange(number);
    },
  }));
  if (spec.number != null) {
    numberItems.push({
      id: "auto",
      text: t("workoutEditor.spec.auto"),
      hasSeparatorBefore: true,
      onSelect: () => {
        onNumberChange(null);
      },
    });
  }

  const rpeItems: MenuItem[] = RPE_VALUES.map((value) => ({
    id: String(value),
    text: t("workoutEditor.spec.rpeValue", { value }),
    isChecked: spec.rpe === value,
    onSelect: () => {
      onChange({ rpe: value });
    },
  }));
  if (spec.rpe != null) {
    rpeItems.push({
      id: "clear",
      text: t("workoutEditor.spec.rpeClear"),
      hasSeparatorBefore: true,
      onSelect: () => {
        onChange({ rpe: null });
      },
    });
  }

  const field = (
    key: "weight" | "reps" | "reps_l" | "reps_r",
    label: string,
    placeholder: string,
  ) => (
    <Input
      wrapperClassName="min-w-0 flex-1"
      fieldSize="sm"
      aria-label={label}
      placeholder={placeholder}
      readOnly={isReadOnly}
      value={String(spec[key] ?? "")}
      onValueChange={(value) => {
        onChange({ [key]: value });
      }}
    />
  );

  return (
    <Row gap={1} align="center" shouldWrap>
      {hasNumberPicker && !spec.warmup ? (
        <Menu
          items={numberItems}
          label={t("workoutEditor.spec.roundHint")}
          isOpen={isNumberOpen}
          onOpenChange={setIsNumberOpen}
          hasExternalTrigger
        >
          <Button
            size="sm"
            variant={
              spec.number != null && spec.number !== set
                ? "primary"
                : "secondary"
            }
            text={String(displayNumber)}
            aria-label={t("workoutEditor.spec.roundNumber", { set })}
            aria-haspopup="menu"
            aria-expanded={isNumberOpen}
            isDisabled={isReadOnly}
            onClick={() => {
              setIsNumberOpen((isShown) => !isShown);
            }}
          />
        </Menu>
      ) : (
        <Text
          tone="muted"
          aria-label={t(
            spec.warmup
              ? "workoutEditor.spec.warmupSet"
              : "workoutEditor.spec.number",
            { set },
          )}
        >
          {spec.warmup ? t("workoutEditor.spec.warmupBadge") : `#${set}`}
        </Text>
      )}

      {field(
        "weight",
        t("workoutEditor.spec.weight", { set }),
        t("workoutEditor.spec.weightPlaceholder"),
      )}
      <Text tone="muted" aria-hidden>
        ×
      </Text>

      {isSplit ? (
        <>
          <Text tone="muted" aria-hidden>
            {t("workoutEditor.spec.left")}
          </Text>
          {field("reps_l", t("workoutEditor.spec.repsLeft", { set }), "0")}
          <Text tone="muted" aria-hidden>
            {t("workoutEditor.spec.right")}
          </Text>
          {field("reps_r", t("workoutEditor.spec.repsRight", { set }), "0")}
        </>
      ) : isTimed ? (
        <Input
          wrapperClassName="min-w-0 flex-1"
          fieldSize="sm"
          inputMode="numeric"
          aria-label={t("workoutEditor.spec.duration", { set })}
          placeholder={t("workoutEditor.fields.durationPlaceholder")}
          readOnly={isReadOnly}
          value={String(spec.duration ?? "")}
          onValueChange={(value) => {
            onChange({ duration: maskDurationInput(value) });
          }}
          onBlur={(event) => {
            if (isReadOnly) return;
            const duration = fmtSetDuration(parseDuration(event.target.value));
            if (duration !== String(spec.duration ?? "")) {
              onChange({ duration });
            }
          }}
        />
      ) : (
        field(
          "reps",
          t("workoutEditor.spec.reps", { set }),
          t("workoutEditor.spec.repsPlaceholder"),
        )
      )}

      {!isTimed && loadType === "unilateral" ? (
        <Button
          size="sm"
          aria-label={t(
            isSplit ? "workoutEditor.spec.merge" : "workoutEditor.spec.split",
            { set },
          )}
          aria-pressed={isSplit}
          isActive={isSplit}
          isDisabled={isReadOnly}
          onClick={() => {
            onChange(splitPatch(spec));
          }}
        >
          {isSplit ? <Unlink2 size={16} /> : <Link2 size={16} />}
        </Button>
      ) : null}

      {hasRpe ? (
        <Menu
          items={rpeItems}
          label={t("workoutEditor.spec.rpeLabel", { set })}
          isOpen={isRpeOpen}
          onOpenChange={setIsRpeOpen}
          hasExternalTrigger
        >
          <Button
            size="sm"
            variant={spec.rpe != null ? "primary" : "secondary"}
            text={
              spec.rpe != null
                ? t("workoutEditor.spec.rpeValue", { value: spec.rpe })
                : t("workoutEditor.spec.rpe")
            }
            aria-label={t("workoutEditor.spec.rpeLabel", { set })}
            aria-haspopup="menu"
            aria-expanded={isRpeOpen}
            isDisabled={isReadOnly}
            onClick={() => {
              setIsRpeOpen((isShown) => !isShown);
            }}
          />
        </Menu>
      ) : null}

      <Button
        size="sm"
        variant={spec.warmup ? "primary" : "ghost"}
        aria-label={t(
          spec.warmup
            ? "workoutEditor.spec.warmupOff"
            : "workoutEditor.spec.warmupOn",
          { set },
        )}
        aria-pressed={!!spec.warmup}
        isDisabled={isReadOnly}
        onClick={() => {
          onChange({ warmup: !spec.warmup });
        }}
      >
        <Flame size={16} />
      </Button>
      <Button
        size="sm"
        aria-label={t("workoutEditor.spec.remove", { set })}
        isDisabled={isReadOnly}
        onClick={onRemove}
      >
        <X size={16} />
      </Button>
    </Row>
  );
}
