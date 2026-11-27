/** Prescribing a workout, and changing a prescription's day and notes */
import {
  Button,
  DatePicker,
  InplaceMultiSelect,
  Input,
  Sheet,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";
import { formatDay } from "@/features/training/lib/coaching";

import { coachingApi, type Prescription, type ProgramDetail } from "./api";
import { coachingErrorText } from "./errorText";
import { useResource } from "./useResource";

/** Every program that has workouts (one request each, as the list has none) */
async function programsWithTemplates(): Promise<ProgramDetail[]> {
  const programs = await coachingApi.programs();
  const detailed = await Promise.all(
    programs.map(async (program) => {
      try {
        const full = await coachingApi.program(program.id);
        return { ...program, templates: full.templates ?? [] };
      } catch {
        return null;
      }
    }),
  );
  return detailed.filter(
    (program): program is NonNullable<typeof program> =>
      !!program?.templates.length,
  );
}

function FormSheet({
  title,
  confirmText,
  isConfirmDisabled,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  confirmText: string;
  isConfirmDisabled: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("training");
  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={title}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            text={t("common.cancel")}
            onClick={onClose}
          />
          <Button
            variant="primary"
            size="md"
            text={confirmText}
            isDisabled={isConfirmDisabled}
            onClick={onConfirm}
          />
        </>
      }
    >
      <Stack gap={4}>{children}</Stack>
    </Sheet>
  );
}

export function PrescribeSheet({
  memberId,
  onClose,
  onSaved,
}: {
  memberId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [dateFormat] = useSetting("lt", "dateFormat");
  const programs = useResource("templates", programsWithTemplates);
  const [date, setDate] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (templateId === null) {
      toast.error(t("coaching.prescribe.pickTemplate"));
      return;
    }
    setIsSaving(true);
    try {
      await coachingApi.createPrescription(memberId, {
        template_id: templateId,
        date,
        notes: notes || null,
      });
      toast.info(t("coaching.prescribe.saved"));
      onClose();
      onSaved();
    } catch (error) {
      toast.error(coachingErrorText(error, t));
      setIsSaving(false);
    }
  };

  return (
    <FormSheet
      title={t("coaching.prescribe.title")}
      confirmText={
        isSaving ? t("coaching.saving") : t("coaching.prescribe.confirm")
      }
      isConfirmDisabled={isSaving || templateId === null}
      onConfirm={() => {
        void save();
      }}
      onClose={onClose}
    >
      <Text variant="small" tone="muted">
        {t("coaching.prescribe.hint")}
      </Text>
      <DatePicker
        label={t("coaching.prescribe.date")}
        value={date}
        onChange={setDate}
        format={(day) => formatDay(day, dateFormat)}
        clearable
      />
      {programs.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : programs.error ? (
        <Text tone="danger" role="alert">
          {coachingErrorText(programs.error, t)}
        </Text>
      ) : !programs.data?.length ? (
        <Text variant="small" tone="muted">
          {t("coaching.prescribe.noTemplates")}
        </Text>
      ) : (
        <InplaceMultiSelect
          label={t("coaching.prescribe.template")}
          placeholder={t("coaching.prescribe.choose")}
          formField
          isFullWidth
          value={templateId === null ? "" : String(templateId)}
          options={programs.data.flatMap((program) =>
            (program.templates ?? []).map((template) => ({
              value: String(template.id),
              label: template.name,
              group: program.name,
            })),
          )}
          onChange={(next) => {
            setTemplateId(Number(next) || null);
          }}
        />
      )}
      <Input
        multiline
        rows={3}
        label={t("coaching.prescribe.notes")}
        placeholder={t("coaching.prescribe.notesPlaceholder")}
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
    </FormSheet>
  );
}

export function EditPrescriptionSheet({
  prescription,
  onClose,
  onSaved,
}: {
  prescription: Prescription;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [dateFormat] = useSetting("lt", "dateFormat");
  const [date, setDate] = useState<string | null>(prescription.date || null);
  const [notes, setNotes] = useState(prescription.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await coachingApi.updatePrescription(prescription.id, {
        date,
        notes: notes || null,
      });
      toast.info(t("coaching.editPrescription.saved"));
      onClose();
      onSaved();
    } catch (error) {
      toast.error(coachingErrorText(error, t));
      setIsSaving(false);
    }
  };

  return (
    <FormSheet
      title={t("coaching.editPrescription.title")}
      confirmText={isSaving ? t("coaching.saving") : t("common.save")}
      isConfirmDisabled={isSaving}
      onConfirm={() => {
        void save();
      }}
      onClose={onClose}
    >
      <Text variant="small" tone="muted">
        {t("coaching.editPrescription.hint")}
      </Text>
      <DatePicker
        label={t("coaching.editPrescription.date")}
        value={date}
        onChange={setDate}
        format={(day) => formatDay(day, dateFormat)}
        clearable
      />
      <Input
        multiline
        rows={3}
        label={t("coaching.editPrescription.notes")}
        placeholder={t("coaching.prescribe.notesPlaceholder")}
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
    </FormSheet>
  );
}
