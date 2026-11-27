/** One exercise of the template: header, targets or per-set rows, notes */
import {
  Button,
  Chip,
  Input,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeftRight,
  ChevronsDown,
  ChevronsUp,
  Info,
  MoreVertical,
  Plus,
  Ruler,
  SlidersHorizontal,
  Timer,
  UnfoldHorizontal,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadTypeMenu } from "../diary/LoadTypeMenu";
import {
  differsFromNext,
  fieldFor,
  type WeekField,
  type WeekValue,
} from "../lib/templateEdit";
import {
  fmtSetDuration,
  maskDurationInput,
  parseDuration,
} from "../lib/workout";
import type {
  LoadType,
  SetSpec,
  SetType,
  WorkoutExercise,
} from "../lib/workoutTypes";
import { ActionMenu } from "./ActionMenu";
import { TemplateSpecRow } from "./TemplateSpecRow";

export interface TemplateExerciseCardProps {
  exercise: WorkoutExercise;
  loadType: LoadType;
  setType: SetType;
  weightUnit: "lbs" | "kg";
  week: number;
  durationWeeks: number;
  isInSuperset: boolean;
  isReadOnly: boolean;
  hasRpe: boolean;
  isRemembered: boolean;
  /** null when there is no room in that direction */
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  menuItems: MenuItem[];
  onInfo: () => void;
  onCopyWeek: () => void;
  onRememberChange: (isRemembered: boolean) => void;
  onPickLoad: (next: LoadType) => void;
  onPickSetType: (next: SetType) => void;
  onWeekValue: (field: WeekField, value: WeekValue) => void;
  onNotes: (notes: string) => void;
  onEnablePerSet: () => void;
  onDisablePerSet: () => void;
  onSpecChange: (setIdx: number, patch: Partial<SetSpec>) => void;
  onSpecNumber: (setIdx: number, number: number | null) => void;
  onSpecRemove: (setIdx: number) => void;
  onSpecAdd: () => void;
}

function loadIcon(loadType: LoadType, setType: SetType) {
  if (loadType === "paired") return <UnfoldHorizontal size={14} />;
  if (loadType === "unilateral") return <ArrowLeftRight size={14} />;
  return setType === "time" ? <Timer size={14} /> : <Ruler size={14} />;
}

export function TemplateExerciseCard(props: TemplateExerciseCardProps) {
  const { exercise, loadType, setType, week, durationWeeks, isReadOnly } =
    props;
  const { t } = useTranslation("training");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const name = exercise.exercise_name ?? "";
  const specs = exercise.set_specs ?? [];

  // The chip names what differs from the default (bilateral, reps)
  const chipText = [
    loadType === "bilateral"
      ? null
      : t(`workoutEditor.loadMenu.load.${loadType}`),
    setType === "time" ? t("workoutEditor.loadMenu.setType.time") : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  const weekInput = (
    field: WeekField,
    label: string,
    placeholder: string,
    isNumber = false,
  ) => (
    <Input
      wrapperClassName="min-w-0 flex-1"
      fieldSize="sm"
      type={isNumber ? "number" : "text"}
      label={label}
      placeholder={placeholder}
      readOnly={isReadOnly}
      value={String(fieldFor(exercise, field, week, durationWeeks))}
      onValueChange={(value) => {
        props.onWeekValue(field, isNumber ? parseInt(value, 10) : value);
      }}
    />
  );

  return (
    <div
      role="group"
      aria-label={name}
      className={
        props.isInSuperset
          ? "p-3"
          : "rounded-container border border-border bg-level-1 p-3"
      }
      onContextMenu={(event) => {
        const target = event.target as Element;
        if (isReadOnly || target.closest("input, textarea")) return;
        event.preventDefault();
        setIsMenuOpen(true);
      }}
    >
      <Stack gap={2}>
        <Row gap={1} align="center" shouldWrap>
          {isReadOnly ? null : (
            <>
              {props.onMoveUp ? (
                <Button
                  size="sm"
                  aria-label={t("workoutEditor.exercise.moveUp", { name })}
                  onClick={props.onMoveUp}
                >
                  <ChevronsUp size={16} />
                </Button>
              ) : null}
              {props.onMoveDown ? (
                <Button
                  size="sm"
                  aria-label={t("workoutEditor.exercise.moveDown", { name })}
                  onClick={props.onMoveDown}
                >
                  <ChevronsDown size={16} />
                </Button>
              ) : null}
            </>
          )}
          {props.isInSuperset ? null : (
            <Chip
              tone="accent"
              text={t("workoutEditor.exercise.setsBadge", {
                count: exercise.target_sets || 1,
              })}
            />
          )}
          <div className="min-w-0 flex-1">
            <Text isTruncated>{name}</Text>
          </div>
          <LoadTypeMenu
            loadType={loadType}
            setType={setType}
            isRemembered={props.isRemembered}
            onRememberChange={props.onRememberChange}
            onPickLoad={props.onPickLoad}
            onPickSetType={props.onPickSetType}
          >
            <Button
              size="sm"
              variant={chipText ? "secondary" : "ghost"}
              text={chipText || undefined}
              aria-label={t("workoutEditor.exercise.loadType", { name })}
              isDisabled={isReadOnly}
            >
              {loadIcon(loadType, setType)}
            </Button>
          </LoadTypeMenu>
          <Button
            size="sm"
            aria-label={t("workoutEditor.exercise.details", { name })}
            onClick={props.onInfo}
          >
            <Info size={16} />
          </Button>
          {!isReadOnly && week < durationWeeks ? (
            <Button
              size="sm"
              variant="secondary"
              text={t("workoutEditor.week.copyExerciseShort", { to: week + 1 })}
              aria-label={t(
                differsFromNext(exercise, week, durationWeeks)
                  ? "workoutEditor.week.copyExercise"
                  : "workoutEditor.week.matches",
                { from: week, to: week + 1 },
              )}
              isDisabled={!differsFromNext(exercise, week, durationWeeks)}
              onClick={props.onCopyWeek}
            />
          ) : null}
          {isReadOnly ? null : (
            <ActionMenu
              label={t("workoutEditor.exercise.options", { name })}
              items={props.menuItems}
              isOpen={isMenuOpen}
              onOpenChange={setIsMenuOpen}
              icon={<MoreVertical size={16} />}
            />
          )}
        </Row>

        {specs.length > 0 ? (
          <Stack gap={2}>
            {specs.map((spec, setIdx) => (
              <TemplateSpecRow
                key={setIdx}
                spec={spec}
                setIdx={setIdx}
                loadType={loadType}
                setType={setType}
                hasRpe={props.hasRpe}
                hasNumberPicker={props.isInSuperset}
                isReadOnly={isReadOnly}
                onChange={(patch) => {
                  props.onSpecChange(setIdx, patch);
                }}
                onNumberChange={(number) => {
                  props.onSpecNumber(setIdx, number);
                }}
                onRemove={() => {
                  props.onSpecRemove(setIdx);
                }}
              />
            ))}
            {isReadOnly ? null : (
              <Row gap={2} justify="between" shouldWrap>
                <Button
                  size="sm"
                  variant="secondary"
                  text={t("workoutEditor.fields.addSet")}
                  onClick={props.onSpecAdd}
                >
                  <Plus size={14} />
                </Button>
                <Button
                  size="sm"
                  text={t("workoutEditor.fields.useUniform")}
                  onClick={props.onDisablePerSet}
                />
              </Row>
            )}
          </Stack>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {weekInput("sets", t("workoutEditor.fields.sets"), "—", true)}
              {setType === "time" ? (
                <Input
                  wrapperClassName="min-w-0 flex-1"
                  fieldSize="sm"
                  inputMode="numeric"
                  label={t("workoutEditor.fields.duration")}
                  placeholder={t("workoutEditor.fields.durationPlaceholder")}
                  readOnly={isReadOnly}
                  value={String(
                    fieldFor(exercise, "duration", week, durationWeeks),
                  )}
                  onValueChange={(value) => {
                    props.onWeekValue("duration", maskDurationInput(value));
                  }}
                  onBlur={(event) => {
                    const duration = fmtSetDuration(
                      parseDuration(event.target.value),
                    );
                    const current = String(
                      fieldFor(exercise, "duration", week, durationWeeks),
                    );
                    if (!isReadOnly && duration !== current) {
                      props.onWeekValue("duration", duration);
                    }
                  }}
                />
              ) : (
                weekInput(
                  "reps",
                  t("workoutEditor.fields.reps"),
                  t("workoutEditor.fields.repsPlaceholder"),
                )
              )}
              {weekInput(
                "weight",
                t("workoutEditor.fields.weight"),
                t(
                  props.weightUnit === "kg"
                    ? "workoutEditor.fields.weightPlaceholderKg"
                    : "workoutEditor.fields.weightPlaceholderLb",
                ),
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {weekInput(
                "tempo",
                t("workoutEditor.fields.tempo"),
                t("workoutEditor.fields.tempoPlaceholder"),
              )}
              {weekInput(
                "rest_sec",
                t("workoutEditor.fields.rest"),
                t("workoutEditor.fields.restPlaceholder"),
                true,
              )}
            </div>
            {isReadOnly ? null : (
              <Row>
                <Button
                  size="sm"
                  text={t("workoutEditor.fields.perSet")}
                  onClick={props.onEnablePerSet}
                >
                  <SlidersHorizontal size={14} />
                </Button>
              </Row>
            )}
          </>
        )}

        <Input
          fieldSize="sm"
          aria-label={t("workoutEditor.fields.notes")}
          placeholder={t("workoutEditor.fields.notesPlaceholder")}
          readOnly={isReadOnly}
          value={exercise.notes ?? ""}
          onValueChange={props.onNotes}
        />
      </Stack>
    </div>
  );
}
