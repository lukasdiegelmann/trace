/**
 * The Smart Log review (old `SmartLogModal.svelte`): what was said is read at
 * once, the user checks the matches and sets, and saves into the diary's day.
 * When nothing can be read, the words stay there to be changed.
 */
import {
  Banner,
  Button,
  Checkbox,
  Chip,
  Dialog,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { aiErrorText, type SmartLogProps } from "@/features/shared/ai";

import { DraftInput } from "../diary/DraftInput";
import { useStore } from "../diary/format";
import { diaryStore } from "../diary/diaryStore";
import { useLtSettings } from "../diary/ltSettings";
import { parseLocalDate } from "../lib/dates";
import type { MatchedExercise, ParsedSet } from "../lib/smartLog";
import {
  fmtSetDuration,
  maskDurationInput,
  parseDuration,
} from "../lib/workout";
import { readSession, saveToDiary } from "./smartLogActions";

interface ReviewSet extends ParsedSet {
  key: number;
}

interface ReviewItem extends MatchedExercise {
  key: number;
  isIncluded: boolean;
  isTimed: boolean;
  sets: ReviewSet[];
}

let keys = 0;

function toReview(matched: MatchedExercise): ReviewItem {
  const sets = matched.sets.length ? matched.sets : [{ reps: 0, weight: 0 }];
  return {
    ...matched,
    key: ++keys,
    isIncluded: true,
    isTimed: sets.some((set) => set.duration_sec),
    sets: sets.map((set) => ({ ...set, key: ++keys })),
  };
}

/** The set as it is saved: the row's key stays on screen */
function withoutKey(set: ReviewSet): ParsedSet {
  const plain: ParsedSet & { key?: number } = { ...set };
  delete plain.key;
  return plain;
}

const toNumber = (text: string) =>
  Math.max(0, parseFloat(text.replace(",", ".")) || 0);

interface SetRowProps {
  set: ReviewSet;
  number: number;
  name: string;
  unit: string;
  isTimed: boolean;
  onChange: (change: Partial<ParsedSet>) => void;
  /** Absent for an exercise's only set */
  onRemove?: () => void;
}

function SetRow({
  set,
  number,
  name,
  unit,
  isTimed,
  onChange,
  onRemove,
}: SetRowProps) {
  const { t } = useTranslation("training");
  const at = { name, number };
  return (
    <Row gap={2} align="center" shouldWrap>
      <Text variant="caption" as="span">
        {`#${number}`}
      </Text>
      <DraftInput
        label={t("assistant.smartLog.weight", at)}
        value={String(set.weight)}
        onDraft={(text) => {
          onChange({ weight: toNumber(text) });
        }}
        className="w-20"
      />
      <Text variant="caption" as="span">
        {`${unit} ×`}
      </Text>
      {isTimed ? (
        <DraftInput
          label={t("assistant.smartLog.duration", at)}
          value={fmtSetDuration(set.duration_sec)}
          mask={maskDurationInput}
          inputMode="numeric"
          placeholder="0:00"
          onDraft={(text) => {
            onChange({ duration_sec: parseDuration(text) ?? 0 });
          }}
          className="w-20"
        />
      ) : (
        <>
          <DraftInput
            label={t("assistant.smartLog.reps", at)}
            value={String(set.reps)}
            inputMode="numeric"
            onDraft={(text) => {
              onChange({ reps: Math.round(toNumber(text)) });
            }}
            className="w-16"
          />
          <Text variant="caption" as="span">
            {t("assistant.smartLog.repsUnit")}
          </Text>
        </>
      )}
      {set.amrap ? <Chip text={t("assistant.smartLog.amrap")} /> : null}
      {set.bodyweight ? (
        <Chip text={t("assistant.smartLog.bodyweight")} />
      ) : null}
      {set.rpe != null ? (
        <Chip text={t("assistant.smartLog.rpe", { value: set.rpe })} />
      ) : null}
      {onRemove ? (
        <Button
          size="sm"
          aria-label={t("assistant.smartLog.removeSet", at)}
          onClick={onRemove}
        >
          <X aria-hidden size={14} />
        </Button>
      ) : null}
    </Row>
  );
}

interface ItemProps {
  item: ReviewItem;
  unit: string;
  onChange: (change: (item: ReviewItem) => ReviewItem) => void;
}

function Item({ item, unit, onChange }: ItemProps) {
  const { t } = useTranslation("training");
  const name = item.best?.name ?? item.name;
  // Anything but one exact match leaves a choice, keeping the words included
  const canChoose =
    item.candidates.length > 1 || (item.candidates[0]?.score ?? 100) < 100;
  const choices = [...item.candidates.slice(0, 4).map((c) => c.exercise), null];
  return (
    <Stack gap={2}>
      <Row gap={2} align="center" shouldWrap>
        <Checkbox
          checked={item.isIncluded}
          onChange={(isIncluded) => {
            onChange((current) => ({ ...current, isIncluded }));
          }}
          label={name}
        />
        {item.best ? null : (
          <Chip tone="muted" text={t("assistant.smartLog.notInLibrary")} />
        )}
        {item.supersetGroup ? (
          <Chip
            tone="accent"
            text={t("assistant.smartLog.superset", {
              group: item.supersetGroup,
            })}
          />
        ) : null}
      </Row>
      {item.isIncluded ? (
        <>
          {canChoose ? (
            <Row
              gap={1}
              shouldWrap
              role="group"
              aria-label={t("assistant.smartLog.match", { name: item.name })}
            >
              {choices.map((choice) => {
                const isChosen =
                  (choice?.id ?? null) === (item.best?.id ?? null);
                return (
                  <Button
                    key={choice?.id ?? "typed"}
                    size="sm"
                    variant={isChosen ? "secondary" : "ghost"}
                    aria-pressed={isChosen}
                    text={
                      choice?.name ??
                      t("assistant.smartLog.asSaid", { name: item.name })
                    }
                    onClick={() => {
                      onChange((current) => ({ ...current, best: choice }));
                    }}
                  />
                );
              })}
            </Row>
          ) : null}
          {item.sets.map((set, index) => (
            <SetRow
              key={set.key}
              set={set}
              number={index + 1}
              name={name}
              unit={unit}
              isTimed={item.isTimed}
              onChange={(change) => {
                onChange((current) => ({
                  ...current,
                  sets: current.sets.map((s) =>
                    s.key === set.key ? { ...s, ...change } : s,
                  ),
                }));
              }}
              onRemove={
                item.sets.length > 1
                  ? () => {
                      onChange((current) => ({
                        ...current,
                        sets: current.sets.filter((s) => s.key !== set.key),
                      }));
                    }
                  : undefined
              }
            />
          ))}
          <Row>
            <Button
              size="sm"
              text={t("assistant.smartLog.addSet")}
              onClick={() => {
                onChange((current) => {
                  const last = current.sets[current.sets.length - 1];
                  return {
                    ...current,
                    sets: [
                      ...current.sets,
                      {
                        key: ++keys,
                        reps: last.reps,
                        weight: last.weight,
                        ...(last.duration_sec
                          ? { duration_sec: last.duration_sec }
                          : {}),
                      },
                    ],
                  };
                });
              }}
            >
              <Plus aria-hidden size={14} />
            </Button>
          </Row>
        </>
      ) : null}
    </Stack>
  );
}

type Phase = "input" | "reading" | "review" | "saving";

export function TrainingSmartLog({ text, onClose }: SmartLogProps) {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const { weightUnit } = useLtSettings();
  const { date } = useStore(diaryStore.state);
  const [words, setWords] = useState(text);
  /** What is being read; a new object reads again */
  const [request, setRequest] = useState(() => (text.trim() ? { text } : null));
  const [phase, setPhase] = useState<Phase>(request ? "reading" : "input");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isClosed = useRef(false);

  useEffect(() => {
    if (!request) return;
    const abort = new AbortController();
    const failed = (message: string) => {
      setError(message);
      setPhase("input");
    };
    readSession(request.text, abort.signal).then(
      (matched) => {
        if (abort.signal.aborted) return;
        if (!matched) failed(t("assistant.smartLog.unreadable"));
        else if (!matched.length) failed(t("assistant.smartLog.noneFound"));
        else {
          setItems(matched.map(toReview));
          setPhase("review");
        }
      },
      (caught: unknown) => {
        if (!abort.signal.aborted) failed(aiErrorText(caught));
      },
    );
    return () => {
      abort.abort();
    };
  }, [request, t]);

  const read = () => {
    if (!words.trim()) return;
    setError(null);
    setPhase("reading");
    setRequest({ text: words.trim() });
  };

  const included = items.filter((item) => item.isIncluded);

  const save = async () => {
    setError(null);
    setPhase("saving");
    try {
      await saveToDiary(
        included.map((item) => ({
          ...item,
          sets: item.sets.map(withoutKey),
        })),
      );
    } catch (caught) {
      setError(
        t("assistant.smartLog.saveFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
      setPhase("review");
      return;
    }
    toast.info(t("assistant.smartLog.added", { count: included.length }));
    if (!isClosed.current) onClose();
  };

  const isReview = phase === "review" || phase === "saving";
  const day = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "full",
  }).format(parseLocalDate(date));

  return (
    <Dialog
      open
      size="lg"
      title={t("assistant.smartLog.title")}
      description={
        isReview
          ? t("assistant.smartLog.reviewHint", { date: day })
          : t("assistant.smartLog.inputHint")
      }
      cancelText={t("common.cancel")}
      confirmText={
        isReview ? t("assistant.smartLog.add") : t("assistant.smartLog.parse")
      }
      onConfirm={isReview ? save : read}
      isConfirmDisabled={
        phase === "reading" || (isReview ? !included.length : !words.trim())
      }
      isBusy={phase === "saving"}
      onOpenChange={(isOpen) => {
        // A save under way finishes first
        if (isOpen || phase === "saving") return;
        isClosed.current = true;
        onClose();
      }}
    >
      <Stack gap={4}>
        {error ? <Banner text={error} /> : null}
        {phase === "input" ? (
          <Input
            multiline
            rows={4}
            autoFocus
            label={t("assistant.smartLog.inputLabel")}
            placeholder={t("assistant.smartLog.inputPlaceholder")}
            value={words}
            onValueChange={setWords}
          />
        ) : null}
        {phase === "reading" ? (
          <Row gap={2} align="center" justify="center">
            <Spinner label={t("assistant.smartLog.reading")} />
            <Text as="span">{t("assistant.smartLog.reading")}</Text>
          </Row>
        ) : null}
        {isReview ? (
          <>
            {items.map((item) => (
              <Item
                key={item.key}
                item={item}
                unit={weightUnit}
                onChange={(change) => {
                  setItems((all) =>
                    all.map((i) => (i.key === item.key ? change(i) : i)),
                  );
                }}
              />
            ))}
            <Row>
              <Button
                size="sm"
                text={t("assistant.smartLog.back")}
                onClick={() => {
                  setError(null);
                  setPhase("input");
                }}
              />
            </Row>
          </>
        ) : null}
      </Stack>
    </Dialog>
  );
}
