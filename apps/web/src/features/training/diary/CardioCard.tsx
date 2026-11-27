import {
  Button,
  Input,
  Island,
  Pressable,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Pin, PinOff, Plus, X, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  buildCardioPayload,
  cardioDistanceUnit,
  cardioFormFromSession,
  EMPTY_CARDIO_FORM,
  isPinned,
  payloadFromTemplate,
  totalCardioMinutes,
  validateCardioForm,
  type CardioForm,
  type CardioSession,
} from "../lib/cardio";
import { cardioApi } from "./cardioBodyApi";
import { useConfirm } from "./useDialogs";
import { useLtSettings } from "./ltSettings";

export interface CardioCardProps {
  date: string;
  /** A session was added, changed or removed: the trained days may differ */
  onChange?: () => void;
}

interface Editing {
  /** null: a new session */
  id: number | null;
  form: CardioForm;
}

const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function CardioCard(props: CardioCardProps) {
  return <CardioCardContent key={props.date} {...props} />;
}

/** The day's cardio sessions with quick-log templates */
function CardioCardContent({ date, onChange }: CardioCardProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { weightUnit } = useLtSettings();
  const distanceUnit = cardioDistanceUnit(weightUnit);
  const [sessions, setSessions] = useState<CardioSession[] | null>(null);
  const [templates, setTemplates] = useState<CardioSession[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadTemplates = useCallback(() => {
    cardioApi
      .templates()
      .then(setTemplates)
      .catch(() => {
        setTemplates([]);
      });
  }, []);

  useEffect(() => {
    let isStale = false;
    void cardioApi
      .byDate(date)
      .catch(() => [] as CardioSession[])
      .then((rows) => {
        if (!isStale) setSessions(rows);
      });
    loadTemplates();
    return () => {
      isStale = true;
    };
  }, [date, loadTemplates]);

  const info = (text: string) => {
    // TODO(monolithium): success tone for toasts
    toast.show({ text, tone: "info" });
  };
  const replace = (row: CardioSession) => {
    setSessions((list) => (list ?? []).map((s) => (s.id === row.id ? row : s)));
  };
  const prepend = (row: CardioSession) => {
    setSessions((list) => [row, ...(list ?? [])]);
    onChange?.();
  };

  const logTemplate = (template: CardioSession) => {
    cardioApi
      .create(payloadFromTemplate(template, date, distanceUnit))
      .then((row) => {
        prepend(row);
        info(t("cardio.toast.logged"));
      })
      .catch((error: unknown) => {
        toast.error(message(error, t("cardio.toast.logFailed")));
      });
  };

  const togglePin = (session: CardioSession) => {
    const shouldPin = !isPinned(session);
    cardioApi
      .setTemplate(session.id, shouldPin)
      .then((row) => {
        replace(row);
        info(shouldPin ? t("cardio.toast.pinned") : t("cardio.toast.unpinned"));
        loadTemplates();
      })
      .catch((error: unknown) => {
        toast.error(message(error, t("cardio.toast.updateFailed")));
      });
  };

  const remove = async (session: CardioSession) => {
    const isConfirmed = await confirm({
      title: t("cardio.confirmDelete.title"),
      text: t("cardio.confirmDelete.message", {
        activity: session.activity,
        duration: session.duration_min,
      }),
      confirmText: t("cardio.confirmDelete.confirm"),
    });
    if (!isConfirmed) return;
    try {
      await cardioApi.remove(session.id);
      setSessions((list) => (list ?? []).filter((s) => s.id !== session.id));
      onChange?.();
    } catch (error) {
      toast.error(message(error, t("cardio.toast.deleteFailed")));
    }
  };

  const submit = async () => {
    if (!editing || isSaving) return;
    const problem = validateCardioForm(editing.form);
    if (problem) {
      toast.error(t(`cardio.toast.${problem}`));
      return;
    }
    const payload = buildCardioPayload(editing.form, date, distanceUnit);
    setIsSaving(true);
    try {
      if (editing.id === null) {
        prepend(await cardioApi.create(payload));
        info(t("cardio.toast.logged"));
      } else {
        replace(await cardioApi.update(editing.id, payload));
        onChange?.();
        info(t("cardio.toast.updated"));
      }
      setEditing(null);
    } catch (error) {
      toast.error(message(error, t("cardio.toast.saveFailed")));
    }
    setIsSaving(false);
  };

  const field = (key: keyof CardioForm) => ({
    value: editing?.form[key] ?? "",
    onValueChange: (value: string) => {
      setEditing((current) =>
        current
          ? { ...current, form: { ...current.form, [key]: value } }
          : current,
      );
    },
  });

  const meta = (session: CardioSession) =>
    [
      t("cardio.meta.duration", { minutes: session.duration_min }),
      session.distance != null
        ? t("cardio.meta.distance", {
            distance: session.distance,
            unit: session.distance_unit || "km",
          })
        : null,
      session.avg_hr != null
        ? t("cardio.meta.hr", { bpm: session.avg_hr })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Island
      title={t("cardio.title")}
      note={
        sessions?.length
          ? t("cardio.totalToday", { minutes: totalCardioMinutes(sessions) })
          : undefined
      }
      actions={
        editing ? undefined : (
          <Button
            size="sm"
            aria-label={t("cardio.addAria")}
            onClick={() => {
              setEditing({ id: null, form: EMPTY_CARDIO_FORM });
            }}
          >
            <Plus aria-hidden size={16} />
          </Button>
        )
      }
    >
      <Stack gap={2}>
        {!editing && templates.length > 0 && (
          <Row
            gap={2}
            shouldWrap
            role="group"
            aria-label={t("cardio.templatesAria")}
          >
            {templates.map((template) => (
              <Button
                key={template.id}
                size="sm"
                variant="secondary"
                text={`${template.activity} · ${t("cardio.templateMinutes", { minutes: template.duration_min })}`}
                aria-label={t("cardio.templateTitle", {
                  activity: template.activity,
                  minutes: template.duration_min,
                })}
                onClick={() => {
                  logTemplate(template);
                }}
              >
                <Zap aria-hidden size={14} />
              </Button>
            ))}
          </Row>
        )}

        {editing && (
          <Stack gap={2}>
            <Input
              autoFocus
              label={t("cardio.activityLabel")}
              placeholder={t("cardio.activityPlaceholder")}
              {...field("activity")}
            />
            <div className="grid grid-cols-3 gap-2 compact:grid-cols-1">
              <Input
                label={t("cardio.durationLabel")}
                placeholder={t("cardio.durationPlaceholder")}
                inputMode="numeric"
                {...field("duration")}
              />
              <Input
                label={t("cardio.distanceLabel")}
                placeholder={t("cardio.distancePlaceholder", {
                  unit: distanceUnit,
                })}
                inputMode="decimal"
                {...field("distance")}
              />
              <Input
                label={t("cardio.hrLabel")}
                placeholder={t("cardio.hrPlaceholder")}
                inputMode="numeric"
                {...field("hr")}
              />
            </div>
            <Input
              label={t("cardio.notesLabel")}
              placeholder={t("cardio.notesPlaceholder")}
              {...field("notes")}
            />
            <Row gap={2} justify="end">
              <Button
                text={t("cardio.cancel")}
                onClick={() => {
                  setEditing(null);
                }}
              />
              <Button
                variant="primary"
                text={
                  isSaving
                    ? t("cardio.saving")
                    : editing.id === null
                      ? t("cardio.logSubmit")
                      : t("cardio.save")
                }
                isDisabled={isSaving}
                onClick={() => void submit()}
              />
            </Row>
          </Stack>
        )}

        {sessions?.map((session) => (
          <Row key={session.id} gap={1} align="center">
            <Pressable
              label={`${t("cardio.editTitle")}: ${session.activity}, ${meta(session)}`}
              onPress={() => {
                setEditing({
                  id: session.id,
                  form: cardioFormFromSession(session),
                });
              }}
              align="start"
              padding={2}
              surface="surface"
              shouldGrow
              canShrink
            >
              <Text as="span">{session.activity}</Text>
              <Text variant="caption" tone="muted" as="span">
                {meta(session)}
              </Text>
              {session.notes && (
                <Text variant="caption" as="span">
                  {session.notes}
                </Text>
              )}
            </Pressable>
            <Button
              size="sm"
              aria-pressed={isPinned(session)}
              aria-label={
                isPinned(session)
                  ? t("cardio.unpinTemplate")
                  : t("cardio.pinTemplate")
              }
              onClick={() => {
                togglePin(session);
              }}
            >
              {isPinned(session) ? (
                <PinOff aria-hidden size={14} />
              ) : (
                <Pin aria-hidden size={14} />
              )}
            </Button>
            <Button
              size="sm"
              aria-label={t("cardio.deleteAria")}
              onClick={() => void remove(session)}
            >
              <X aria-hidden size={14} />
            </Button>
          </Row>
        ))}
        {sessions?.length === 0 && !editing && (
          <Text variant="small" tone="muted">
            {t("cardio.empty")}
          </Text>
        )}
      </Stack>
      {dialog}
    </Island>
  );
}
