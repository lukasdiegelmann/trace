import {
  Button,
  DatePicker,
  Dialog,
  FileInput,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import { MEAL_TYPES, type MealType } from "../../lib/cookDiary";
import { todayIso } from "../../lib/dates";
import { mealTypeAt } from "../../lib/mealType";
import type { Cook, CookInput } from "../../recipesApi";
import { uploadImage } from "../../uploads";
import { StarRating } from "../ui/StarRating";

import { PhotoStrip } from "./PhotoLightbox";

export interface CookLogDialogProps {
  recipeName: string;
  /** Set when changing an entry; meal and rating can't be changed then */
  editing: Cook | null;
  onClose: () => void;
  onSave: (input: CookInput) => Promise<void>;
}

const photosOf = (cook: Cook | null) => {
  if (!cook) return [];
  if (cook.photos?.length) return cook.photos;
  return cook.photo_url ? [cook.photo_url] : [];
};

/** "I cooked this": when, how it was, with notes and photos */
export function CookLogDialog({
  recipeName,
  editing,
  onClose,
  onSave,
}: CookLogDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [date, setDate] = useState(editing?.date ?? todayIso());
  const [meal, setMeal] = useState<MealType | null>(() =>
    editing ? null : mealTypeAt(new Date().getHours()),
  );
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [photos, setPhotos] = useState(() => photosOf(editing));
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const upload = async (file: File) => {
    setUploading((count) => count + 1);
    try {
      const stored = await uploadImage(file, file.name);
      setPhotos((previous) => [...previous, stored]);
    } catch (caught) {
      notify.failure(caught, t("cookingCommon.photo.uploadFailed"));
    } finally {
      setUploading((count) => count - 1);
    }
  };

  const addUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhotos((previous) => [...previous, trimmed]);
    setUrl("");
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave({
        date,
        notes: notes.trim() || null,
        photos,
        photo_url: photos[0] ?? null,
        ...(editing ? {} : { meal_type: meal, rating: rating || null }),
      });
    } catch (caught) {
      notify.failure(caught, t("recipeView.cookLog.failed"));
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isSaving) onClose();
      }}
      title={
        editing
          ? t("recipeView.cookLog.editTitle")
          : t("recipeView.cookLog.title")
      }
      description={recipeName}
      cancelText={t("cookingCommon.cancel")}
      confirmText={
        editing ? t("recipeView.cookLog.saveChanges") : t("cookingCommon.save")
      }
      onConfirm={save}
      isBusy={isSaving}
      isConfirmDisabled={uploading > 0 || !date}
    >
      <Stack gap={4}>
        <DatePicker
          label={t("recipeView.cookLog.date")}
          value={date}
          maxDate={todayIso()}
          onChange={(next) => {
            setDate(next ?? todayIso());
          }}
        />
        {editing ? null : (
          <>
            <Stack
              gap={2}
              role="group"
              aria-label={t("recipeView.cookLog.meal")}
            >
              <Text variant="label">{t("recipeView.cookLog.meal")}</Text>
              <Row gap={2} shouldWrap>
                {MEAL_TYPES.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={meal === option ? "primary" : "secondary"}
                    aria-pressed={meal === option}
                    text={t(`recipeView.cookLog.meals.${option}`)}
                    onClick={() => {
                      setMeal(meal === option ? null : option);
                    }}
                  />
                ))}
              </Row>
            </Stack>
            <Stack gap={1}>
              <Text variant="label">{t("recipeView.cookLog.rating")}</Text>
              <StarRating value={rating} onChange={setRating} />
            </Stack>
          </>
        )}
        <Input
          multiline
          rows={3}
          label={t("recipeView.cookLog.notes")}
          placeholder={t("recipeView.cookLog.notesPlaceholder")}
          value={notes}
          onValueChange={setNotes}
        />
        <Stack gap={2}>
          <Text variant="label">{t("recipeView.cookLog.photos")}</Text>
          <PhotoStrip
            photos={photos}
            onRemove={(index) => {
              setPhotos((previous) => previous.filter((_, i) => i !== index));
            }}
          />
          {uploading > 0 ? (
            <Spinner label={t("cookingCommon.photo.uploading")} />
          ) : null}
          <FileInput
            accept="image/*"
            capture="environment"
            text={t("cookingCommon.photo.choose")}
            captureText={t("cookingCommon.photo.camera")}
            placeholder={t("cookingCommon.photo.noFile")}
            file={null}
            onChange={(file) => {
              if (file) void upload(file);
            }}
          />
          <Row gap={2} align="end">
            <div className="min-w-0 flex-1">
              <Input
                type="url"
                label={t("cookingCommon.photo.url")}
                value={url}
                onValueChange={setUrl}
                onEnter={addUrl}
              />
            </div>
            <Button
              size="md"
              variant="secondary"
              text={t("cookingCommon.add")}
              isDisabled={!url.trim()}
              onClick={addUrl}
            />
          </Row>
        </Stack>
      </Stack>
    </Dialog>
  );
}
