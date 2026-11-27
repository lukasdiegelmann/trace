import {
  Button,
  EmptyState,
  FileInput,
  Input,
  Row,
  Sheet,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { BODY_STATS_SAVED } from "../common/events";
import { addProgressPhoto } from "../progress/api";
import {
  bodyStatToInput,
  bodyStatUnit,
  formatBodyStatsDate,
  mergeBodyStatsDrafts,
  parseBodyStatsResponse,
  visibleBodyStats,
  type BodyStatValues,
} from "../lib/bodyStats";
import { bodyStatsApi } from "./cardioBodyApi";
import { useLtSettings } from "./ltSettings";

export interface BodyStatsSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  date: string;
}

export function BodyStatsSheet(props: BodyStatsSheetProps) {
  if (!props.isOpen) return null;
  return <BodyStatsSheetContent key={props.date} {...props} />;
}

/** The day's measurements and progress photo */
function BodyStatsSheetContent({
  isOpen,
  onOpenChange,
  date,
}: BodyStatsSheetProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const { weightUnit, dateFormat, bodyStatsVisible } = useLtSettings();
  const [stats, setStats] = useState<BodyStatValues>({});
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const visible = visibleBodyStats(bodyStatsVisible);

  useEffect(() => {
    let isStale = false;
    bodyStatsApi
      .get(date)
      .then((data) => {
        if (!isStale) setStats(parseBodyStatsResponse(data));
      })
      .catch(() => undefined);
    return () => {
      isStale = true;
    };
  }, [date]);

  const save = async () => {
    setIsSaving(true);
    try {
      await bodyStatsApi.save(date, mergeBodyStatsDrafts(stats, drafts));
      // TODO(monolithium): success tone for toasts
      toast.show({ text: t("bodyStats.saved"), tone: "info" });
      window.dispatchEvent(
        new CustomEvent(BODY_STATS_SAVED, { detail: { date } }),
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("bodyStats.saveFailed"),
      );
    }
    setIsSaving(false);
  };

  const addPhoto = async (file: File) => {
    setIsAdding(true);
    try {
      await addProgressPhoto(file, date);
      toast.show({ text: t("bodyStats.photo.added"), tone: "info" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("bodyStats.photo.addFailed"),
      );
    }
    setIsAdding(false);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("bodyStats.title")}
      description={formatBodyStatsDate(date, dateFormat)}
      footer={
        <Button
          variant="primary"
          isFullWidth
          text={isSaving ? t("bodyStats.saving") : t("bodyStats.save")}
          isDisabled={isSaving || visible.length === 0}
          onClick={() => void save()}
        />
      }
    >
      <Stack gap={4}>
        {visible.length === 0 ? (
          <EmptyState text={t("bodyStats.noneEnabled")} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((id) => (
              <Input
                key={id}
                label={t("bodyStats.fieldLabel", {
                  label: t(`bodyStats.stats.${id}`),
                  unit: bodyStatUnit(id, weightUnit),
                })}
                inputMode="decimal"
                placeholder={t("bodyStats.valuePlaceholder")}
                value={drafts[id] ?? bodyStatToInput(stats[id])}
                onValueChange={(text) => {
                  setDrafts((current) => ({
                    ...current,
                    [id]: text.replace(",", "."),
                  }));
                }}
              />
            ))}
          </div>
        )}
        <Stack gap={1}>
          <Text variant="caption" tone="muted">
            {t("bodyStats.photo.hint")}
          </Text>
          <FileInput
            accept="image/*"
            text={
              isAdding ? t("bodyStats.photo.adding") : t("bodyStats.photo.add")
            }
            disabled={isAdding}
            file={null}
            onChange={(file) => {
              if (file) void addPhoto(file);
            }}
          />
        </Stack>
        <Row>
          <Button
            text={t("bodyStats.photo.viewTimeline")}
            isIconTrailing
            onClick={() => {
              onOpenChange(false);
              void navigate("/training/progress");
            }}
          >
            <ArrowRight aria-hidden size={14} />
          </Button>
        </Row>
      </Stack>
    </Sheet>
  );
}
