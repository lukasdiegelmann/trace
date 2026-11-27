import {
  Button,
  Checkbox,
  DatePicker,
  InplaceMultiSelect,
  Sheet,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";
import { formatDay } from "@/features/training/lib/coaching";

import { coachingApi } from "./api";
import { coachingErrorText } from "./errorText";
import { useResource } from "./useResource";

export interface AssignProgramSheetProps {
  memberId: number;
  memberName: string;
  onClose: () => void;
  onAssigned: () => void;
}

/** Assigns one of the coach's programs to this client */
export function AssignProgramSheet({
  memberId,
  memberName,
  onClose,
  onAssigned,
}: AssignProgramSheetProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const [dateFormat] = useSetting("lt", "dateFormat");
  const programs = useResource("assignable", coachingApi.programs);
  const [programId, setProgramId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [shouldActivate, setShouldActivate] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const assign = async () => {
    if (programId === null) {
      toast.error(t("coaching.assign.pickProgram"));
      return;
    }
    setIsSaving(true);
    try {
      await coachingApi.assignProgram(programId, {
        user_id: memberId,
        start_date: startDate,
        make_active: shouldActivate,
      });
      const program =
        programs.data?.find((p) => p.id === programId)?.name ??
        t("coaching.assign.programFallback");
      toast.info(
        shouldActivate
          ? t("coaching.assign.assigned", { program, name: memberName })
          : t("coaching.assign.added", { program, name: memberName }),
      );
      onClose();
      onAssigned();
    } catch (error) {
      toast.error(coachingErrorText(error, t));
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("coaching.assign.title")}
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
            text={
              isSaving
                ? t("coaching.assign.assigning")
                : t("coaching.assign.confirm")
            }
            isDisabled={isSaving || programId === null}
            onClick={() => {
              void assign();
            }}
          />
        </>
      }
    >
      <Stack gap={4}>
        <Text variant="small" tone="muted">
          <Trans
            t={t}
            i18nKey="coaching.assign.hint"
            values={{ name: memberName }}
            components={{ strong: <strong /> }}
          />
        </Text>
        {programs.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : programs.error ? (
          <Text tone="danger" role="alert">
            {coachingErrorText(programs.error, t)}
          </Text>
        ) : !programs.data?.length ? (
          <Text variant="small" tone="muted">
            {t("coaching.assign.noPrograms")}
          </Text>
        ) : (
          <InplaceMultiSelect
            label={t("coaching.assign.program")}
            placeholder={t("coaching.assign.choose")}
            formField
            isFullWidth
            value={programId === null ? "" : String(programId)}
            options={programs.data.map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
            onChange={(next) => {
              setProgramId(Number(next) || null);
            }}
          />
        )}
        <DatePicker
          label={t("coaching.assign.startDate")}
          value={startDate}
          onChange={setStartDate}
          format={(day) => formatDay(day, dateFormat)}
          clearable
        />
        <Stack gap={1} align="start">
          <Checkbox
            checked={shouldActivate}
            onChange={setShouldActivate}
            label={t("coaching.assign.makeActive")}
          />
          <Text variant="caption">{t("coaching.assign.makeActiveHint")}</Text>
        </Stack>
      </Stack>
    </Sheet>
  );
}
