import {
  Button,
  Field,
  Input,
  Row,
  SegmentedControl,
  Sheet,
  Stack,
  useToast,
} from "@monocircuit/monolithium/components";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { ToggleChips } from "../common/ToggleChips";
import { CATEGORIES, EQUIPMENT, MUSCLES } from "../lib/workout";
import { createExercise, type Exercise, updateExercise } from "./api";
import { categoryLabel, equipmentLabel, muscleLabel } from "./labels";
import { MediaInput } from "./MediaInput";

export interface ExerciseEditorProps {
  isOpen: boolean;
  /** The exercise to change; none creates a new one */
  exercise?: Exercise | null;
  /** The name of a new exercise, e.g. what a picker searched for */
  prefillName?: string;
  onClose: () => void;
  onSaved: (exercise: Exercise) => void;
}

/** Creates or edits a custom exercise */
export function ExerciseEditor(props: ExerciseEditorProps) {
  const { isOpen, exercise, onClose } = props;
  const { t } = useTranslation("training");
  return (
    <Sheet
      isOpen={isOpen}
      title={
        exercise
          ? t("exerciseEditor.editTitle")
          : t("exerciseEditor.createTitle")
      }
      onOpenChange={(isUp) => {
        if (!isUp) onClose();
      }}
    >
      {/* Mounted per opening, so the fields start from the exercise */}
      {isOpen && <EditorForm key={exercise?.id ?? "new"} {...props} />}
    </Sheet>
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

type LoadChoice = "unset" | "bilateral" | "paired" | "unilateral";
type SetChoice = "unset" | "reps" | "time";

function EditorForm({
  exercise,
  prefillName,
  onClose,
  onSaved,
}: ExerciseEditorProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [customEquipment, setCustomEquipment] = useSetting(
    "lt",
    "customEquipment",
  );
  const custom = customEquipment as string[];

  const [name, setName] = useState(exercise?.name ?? prefillName ?? "");
  const [category, setCategory] = useState(exercise?.category ?? "");
  const [media, setMedia] = useState({
    img_url: exercise?.img_url ?? "",
    gif_url: exercise?.gif_url ?? "",
    video_url: exercise?.video_url ?? "",
  });
  const [loadType, setLoadType] = useState<LoadChoice>(
    (exercise?.load_type as LoadChoice | undefined) || "unset",
  );
  const [setType, setSetType] = useState<SetChoice>(
    (exercise?.set_type as SetChoice | undefined) || "unset",
  );
  const [equipment, setEquipment] = useState(exercise?.equipment ?? []);
  const [primary, setPrimary] = useState(exercise?.primary_muscles ?? []);
  const [secondary, setSecondary] = useState(exercise?.secondary_muscles ?? []);
  const [instructions, setInstructions] = useState(
    exercise?.instructions ?? "",
  );
  const [tips, setTips] = useState(exercise?.tips ?? "");
  const [newEquipment, setNewEquipment] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const equipmentChoices = [
    ...new Set<string>([...EQUIPMENT, ...custom, ...equipment]),
  ];

  const addEquipment = () => {
    const value = newEquipment?.trim();
    setNewEquipment(null);
    if (!value) return;
    if (
      !custom.includes(value) &&
      !(EQUIPMENT as readonly string[]).includes(value)
    ) {
      setCustomEquipment([...custom, value]);
    }
    if (!equipment.includes(value)) setEquipment([...equipment, value]);
  };

  const save = async () => {
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    const input = {
      name: name.trim(),
      category: category || null,
      primary_muscles: primary,
      secondary_muscles: secondary,
      equipment,
      instructions: instructions.trim() || null,
      tips: tips.trim() || null,
      img_url: media.img_url || null,
      gif_url: media.gif_url || null,
      video_url: media.video_url || null,
      load_type: loadType === "unset" ? null : loadType,
      set_type: setType === "unset" ? null : setType,
    };
    try {
      const saved = exercise
        ? await updateExercise(exercise.id, input)
        : await createExercise(input);
      toast.info(
        exercise
          ? t("exerciseEditor.updated")
          : t("exerciseEditor.added", { name: saved.name }),
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(t("common.error", { message: (error as Error).message }));
      setIsSaving(false);
    }
  };

  const muscleChips = MUSCLES.map((muscle) => ({
    value: muscle,
    label: muscleLabel(t, muscle),
  }));

  return (
    <Stack gap={4}>
      <Input
        label={t("exerciseEditor.name")}
        placeholder={t("exerciseEditor.namePlaceholder")}
        value={name}
        onValueChange={setName}
        autoFocus
      />
      <Field label={t("exerciseEditor.category")}>
        <ToggleChips
          label={t("exerciseEditor.category")}
          options={CATEGORIES.map((id) => ({
            value: id,
            label: categoryLabel(t, id),
          }))}
          selected={category ? [category] : []}
          onToggle={(id) => {
            setCategory(category === id ? "" : id);
          }}
        />
      </Field>
      <Field label={t("exerciseEditor.media.label")}>
        <MediaInput
          value={media}
          onChange={(next) => {
            setMedia({
              img_url: next.img_url ?? "",
              gif_url: next.gif_url ?? "",
              video_url: next.video_url ?? "",
            });
          }}
        />
      </Field>
      <Field label={t("exerciseEditor.loadType.label")}>
        <SegmentedControl<LoadChoice>
          aria-label={t("exerciseEditor.loadType.label")}
          value={loadType}
          onChange={setLoadType}
          options={(
            ["unset", "bilateral", "paired", "unilateral"] as const
          ).map((value) => ({
            value,
            label: t(`exerciseEditor.loadType.${value}`),
          }))}
        />
      </Field>
      <Field label={t("exerciseEditor.setType.label")}>
        <SegmentedControl<SetChoice>
          aria-label={t("exerciseEditor.setType.label")}
          value={setType}
          onChange={setSetType}
          options={(["unset", "reps", "time"] as const).map((value) => ({
            value,
            label: t(`exerciseEditor.setType.${value}`),
          }))}
        />
      </Field>
      <Field label={t("exerciseEditor.equipment")}>
        <Stack gap={2}>
          <ToggleChips
            label={t("exerciseEditor.equipment")}
            options={equipmentChoices.map((value) => ({
              value,
              label: equipmentLabel(t, value),
            }))}
            selected={equipment}
            onToggle={(value) => {
              setEquipment(toggle(equipment, value));
            }}
          />
          {newEquipment === null ? (
            <Row>
              <Button
                size="sm"
                variant="secondary"
                text={t("exerciseEditor.addEquipment")}
                onClick={() => {
                  setNewEquipment("");
                }}
              >
                <Plus aria-hidden size={16} />
              </Button>
            </Row>
          ) : (
            <Input
              aria-label={t("exerciseEditor.addEquipment")}
              placeholder={t("exerciseEditor.equipmentPlaceholder")}
              value={newEquipment}
              onValueChange={setNewEquipment}
              onEnter={addEquipment}
              onBlur={addEquipment}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.stopPropagation();
                setNewEquipment(null);
              }}
              autoFocus
            />
          )}
        </Stack>
      </Field>
      <Field
        label={t("exerciseEditor.primaryMuscles")}
        hint={t("exerciseEditor.primaryHint")}
      >
        <ToggleChips
          label={t("exerciseEditor.primaryMuscles")}
          options={muscleChips}
          selected={primary}
          onToggle={(muscle) => {
            setPrimary(toggle(primary, muscle));
            // A muscle is one or the other, never both.
            setSecondary(secondary.filter((m) => m !== muscle));
          }}
        />
      </Field>
      <Field label={t("exerciseEditor.secondaryMuscles")}>
        <ToggleChips
          label={t("exerciseEditor.secondaryMuscles")}
          options={muscleChips}
          selected={secondary}
          onToggle={(muscle) => {
            setSecondary(toggle(secondary, muscle));
            setPrimary(primary.filter((m) => m !== muscle));
          }}
        />
      </Field>
      <Input
        multiline
        rows={4}
        label={t("exerciseEditor.instructions")}
        placeholder={t("exerciseEditor.instructionsPlaceholder")}
        value={instructions}
        onValueChange={setInstructions}
      />
      <Input
        multiline
        rows={2}
        label={t("exerciseEditor.tips")}
        placeholder={t("exerciseEditor.tipsPlaceholder")}
        value={tips}
        onValueChange={setTips}
      />
      <Row gap={2} justify="end">
        <Button text={t("common.cancel")} onClick={onClose} />
        <Button
          variant="primary"
          text={
            exercise
              ? t("exerciseEditor.saveChanges")
              : t("exerciseEditor.create")
          }
          isLoading={isSaving}
          isDisabled={!name.trim()}
          onClick={() => void save()}
        />
      </Row>
    </Stack>
  );
}
