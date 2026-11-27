import {
  Disclosure,
  Input,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The day's note, saved when the field is left. `value` is the stored note;
 * mount with the date as key so a draft never moves to another day.
 */
export function NotesField({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => Promise<unknown>;
}) {
  const { t } = useTranslation("nutrition");
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const text = draft ?? value;

  const commit = async () => {
    if (draft === null) return;
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
    setDraft(null);
  };

  return (
    <Stack gap={1}>
      <Input
        multiline
        rows={3}
        aria-label={t("diary.notes.title")}
        placeholder={t("diary.notes.placeholder")}
        value={text}
        onValueChange={setDraft}
        onBlur={() => void commit()}
      />
      <Text variant="caption">
        {isSaving
          ? t("diary.notes.saving")
          : t("diary.notes.characters", { count: text.length })}
      </Text>
    </Stack>
  );
}

/** The collapsible card in the main column; folded on a day without a note */
export function NotesCard({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => Promise<unknown>;
}) {
  const { t } = useTranslation("nutrition");
  const [isOpen, setIsOpen] = useState(value !== "");
  return (
    <Stack gap={1}>
      <Disclosure
        title={t("diary.notes.title")}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      >
        <NotesField value={value} onSave={onSave} />
      </Disclosure>
      {!isOpen && value !== "" && (
        <Text variant="caption" isTruncated>
          {value}
        </Text>
      )}
    </Stack>
  );
}
