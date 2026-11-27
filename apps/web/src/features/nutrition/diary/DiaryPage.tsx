import {
  Banner,
  Button,
  DatePicker,
  Row,
  Spinner,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ChevronLeft,
  ChevronRight,
  Droplet,
  PanelRight,
  PanelRightClose,
  Scale,
  StickyNote,
  Trash2,
  X,
  ChartColumn,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import type { DiaryItem } from "../api";
import { AppDialog } from "../components/AppDialog";
import { addDays, isIsoDate, localDateStr, parseIsoDate } from "../lib/dates";
import { isSplit, itemsOfMeal, setNote } from "../lib/diary";
import { useNtSettings } from "../settings";
import { useIsWide } from "../useIsWide";
import { useNutritionFormat } from "../useNutritionFormat";
import { ActivitySection } from "./ActivitySection";
import { CompletionBar } from "./CompletionBar";
import { DiaryDialogs, type DiaryDialog } from "./DiaryDialogs";
import { FastingWidget } from "./FastingWidget";
import { MealCard } from "./MealCard";
import { NotesCard } from "./NotesCard";
import { RailWidgets } from "./Rail";
import { TotalsBar } from "./TotalsBar";
import { useDayGoal } from "./useDayGoal";
import { useDiaryActions } from "./useDiaryActions";
import { useDiaryDay } from "./useDiaryDay";
import { useRailMode } from "./useRailMode";
import { WeekStrip } from "./WeekStrip";

const SCROLL_KEY = "nt:diaryScroll";

/**
 * Today as the clock says, kept current: coming back to the tab on a new day
 * moves on to it, but only if the previous today was on show.
 */
function useDiaryDate(): [string, (date: string) => void] {
  const [params, setParams] = useSearchParams();
  const asked = params.get("date");
  const [today, setToday] = useState(() => localDateStr());
  useEffect(() => {
    const check = () => {
      setToday(localDateStr());
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  const date = isIsoDate(asked) ? asked : today;
  return [
    date,
    (next) => {
      setParams(next === localDateStr() ? {} : { date: next }, {
        replace: true,
      });
    },
  ];
}

export function DiaryPage() {
  const [date, setDate] = useDiaryDate();
  // Keyed by date: selection, open recipes and dialogs belong to one day
  return <DiaryDayView key={date} date={date} onSelectDate={setDate} />;
}

function DiaryDayView({
  date,
  onSelectDate,
}: {
  date: string;
  onSelectDate: (date: string) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings, isLoaded } = useNtSettings();
  const format = useNutritionFormat();
  const navigate = useNavigate();
  const isWide = useIsWide();
  const state = useDiaryDay(date);
  const goal = useDayGoal(date);
  const actions = useDiaryActions(date, state, goal);
  const [dialog, setDialog] = useState<DiaryDialog | null>(null);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [railMode, setRailMode] = useRailMode();
  const [isRailOpen, setIsRailOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { day } = state;

  // Back from the food picker, to where the diary was left
  const isReady = day !== null && isLoaded;
  useEffect(() => {
    if (!isReady) return;
    const stored = sessionStorage.getItem(SCROLL_KEY);
    if (stored === null) return;
    sessionStorage.removeItem(SCROLL_KEY);
    const scroller = root.current?.closest("main");
    if (scroller) scroller.scrollTop = Number(stored);
  }, [isReady]);

  const today = localDateStr();
  const dayLabel =
    date === today
      ? t("common.today")
      : date === addDays(today, -1)
        ? t("common.yesterday")
        : date === addDays(today, 1)
          ? t("common.tomorrow")
          : parseIsoDate(date).toLocaleDateString(format.locale, {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

  const openPicker = (meal: number, replaceUuid?: string) => {
    const scroller = root.current?.closest("main");
    if (scroller) {
      sessionStorage.setItem(SCROLL_KEY, String(scroller.scrollTop));
    }
    const params = new URLSearchParams({
      pick: "1",
      meal: String(meal),
      date,
    });
    if (replaceUuid) params.set("replace", replaceUuid);
    void navigate(`/nutrition/foods?${params.toString()}`);
  };

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (!next.delete(value)) next.add(value);
    return next;
  };
  const toggleSelected = (uuid: string) => {
    const next = toggle(selection ?? new Set(), uuid);
    // Deselecting the last one leaves select mode
    setSelection(next.size > 0 ? next : null);
  };

  const itemActions = (item: DiaryItem): MenuItem[] => {
    const canSelect =
      item.type !== "quick_calories" ||
      settings.quickCaloriesDisplay === "separate";
    const canSplit =
      !isSplit(item) &&
      (Boolean(item.is_recipe) || (item.items?.length ?? 0) > 0);
    return [
      {
        id: "edit",
        text: t("diary.actions.edit"),
        onSelect: () => {
          setDialog({ kind: "edit", uuid: item.uuid });
        },
      },
      {
        id: "replace",
        text: t("diary.actions.replace"),
        onSelect: () => {
          openPicker(item.meal, item.uuid);
        },
      },
      {
        id: "move",
        text: t("diary.actions.move"),
        onSelect: () => {
          setDialog({ kind: "move", uuid: item.uuid });
        },
      },
      {
        id: "copy",
        text: t("diary.actions.copy"),
        onSelect: () => {
          setDialog({ kind: "copyItem", uuid: item.uuid });
        },
      },
      ...(canSelect
        ? [
            {
              id: "select",
              text: t("diary.actions.select"),
              onSelect: () => {
                setSelection(new Set([item.uuid]));
              },
            },
          ]
        : []),
      ...(canSplit
        ? [
            {
              id: "split",
              text: t("diary.actions.split"),
              onSelect: () => {
                void actions.split(item).then((isDone) => {
                  if (isDone) {
                    setExpanded((open) => new Set(open).add(item.uuid));
                  }
                });
              },
            },
          ]
        : []),
      {
        id: "delete",
        text: t("diary.actions.delete"),
        tone: "danger" as const,
        hasSeparatorBefore: true,
        onSelect: () => void actions.remove(item),
      },
    ];
  };

  const mealActions = (meal: number, count: number): MenuItem[] =>
    count === 0
      ? [
          {
            id: "add",
            text: t("diary.addFood"),
            onSelect: () => {
              openPicker(meal);
            },
          },
        ]
      : [
          {
            id: "moveAll",
            text: t("diary.actions.moveAll"),
            onSelect: () => {
              setDialog({ kind: "moveMeal", meal });
            },
          },
          {
            id: "copy",
            text: t("diary.actions.copy"),
            onSelect: () => {
              setDialog({ kind: "copyMeal", meal });
            },
          },
          {
            id: "save",
            text: t("diary.actions.saveAsMeal"),
            onSelect: () => {
              setDialog({ kind: "saveMeal", meal });
            },
          },
          {
            id: "clear",
            text: t("diary.actions.clearAll"),
            tone: "danger" as const,
            hasSeparatorBefore: true,
            onSelect: () => void actions.clearMeal(meal),
          },
        ];

  const mealCard = (name: string, index: number) => {
    if (!day) return null;
    const items = itemsOfMeal(day.items, index);
    return (
      <MealCard
        key={index}
        index={index}
        name={name}
        items={items}
        isCompleted={day.completed_meals.includes(index)}
        isDraggable={isWide && !selection}
        expanded={expanded}
        onToggleExpanded={(uuid) => {
          setExpanded(toggle(expanded, uuid));
        }}
        selection={selection}
        onToggleSelected={toggleSelected}
        itemActions={itemActions}
        mealActions={mealActions(index, items.length)}
        onEdit={(item) => {
          setDialog({ kind: "edit", uuid: item.uuid });
        }}
        onEditChild={(item, child) => {
          setDialog({ kind: "edit", uuid: item.uuid, child });
        }}
        onRemoveChild={(item, child) => {
          actions.removeIngredient(item.uuid, child);
        }}
        onRemoveQuick={(item) => {
          actions.removeQuick(item);
        }}
        onAdd={() => {
          openPicker(index);
        }}
        onQuickAdd={() => {
          setDialog({ kind: "quickAdd", meal: index });
        }}
        onToggleCompleted={() => void actions.toggleMeal(index)}
        onShowTotals={() => {
          setDialog({ kind: "mealTotals", meal: index });
        }}
        onDropItem={(uuid) => {
          actions.drop(uuid, index);
        }}
      />
    );
  };

  const isRailPinned = isWide && railMode === "pinned";
  const rail = day && (
    <RailWidgets
      day={day}
      goal={goal}
      mutate={state.mutate}
      onOpenSummary={() => {
        setDialog({ kind: "summary" });
      }}
      onOpenWater={() => {
        setDialog({ kind: "water" });
      }}
      onOpenBodyStats={() => {
        setDialog({ kind: "bodyStats" });
      }}
    />
  );
  const headerButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <Button size="sm" aria-label={label} onClick={onClick}>
      {icon}
    </Button>
  );

  return (
    <div ref={root} className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Row
          gap={2}
          align="center"
          justify="between"
          shouldWrap
          className="sticky top-0 z-10 bg-level-0 py-2"
        >
          {selection ? (
            <Text variant="heading" as="h2">
              {t("diary.selected", { count: selection.size })}
            </Text>
          ) : (
            <Row gap={1} align="center">
              {headerButton(
                t("diary.previousDay"),
                <ChevronLeft aria-hidden size={18} />,
                () => {
                  onSelectDate(addDays(date, -1));
                },
              )}
              {/* TODO(monolithium): mark completed days in the DatePicker */}
              <DatePicker
                value={date}
                onChange={(next) => {
                  if (next && isIsoDate(next)) onSelectDate(next);
                }}
                format={(value) =>
                  value === date
                    ? `${dayLabel} · ${format.date(value)}`
                    : format.date(value)
                }
                placeholder={t("diary.chooseDate")}
              />
              {headerButton(
                t("diary.nextDay"),
                <ChevronRight aria-hidden size={18} />,
                () => {
                  onSelectDate(addDays(date, 1));
                },
              )}
              {settings.diaryShowNotes && day?.notes.trim() && (
                <span role="img" aria-label={t("diary.hasNote")}>
                  <StickyNote aria-hidden size={16} />
                </span>
              )}
              {settings.diaryShowCompletion && day?.completed_at && (
                <span role="img" aria-label={t("diary.dayDone")}>
                  <CheckCircle2 aria-hidden size={16} />
                </span>
              )}
            </Row>
          )}
          <Row gap={1} align="center">
            {selection ? (
              <>
                {headerButton(
                  t("diary.exitSelect"),
                  <X aria-hidden size={18} />,
                  () => {
                    setSelection(null);
                  },
                )}
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={t("diary.deleteSelected")}
                  isDisabled={selection.size === 0}
                  onClick={() => {
                    void actions.removeMany([...selection]).then((isDone) => {
                      if (isDone) setSelection(null);
                    });
                  }}
                >
                  <Trash2 aria-hidden size={18} />
                </Button>
              </>
            ) : (
              <>
                {settings.waterShowInDiary &&
                  headerButton(
                    t("diary.openWater"),
                    <Droplet aria-hidden size={18} />,
                    () => {
                      setDialog({ kind: "water" });
                    },
                  )}
                {headerButton(
                  t("diary.openSummary"),
                  <ChartColumn aria-hidden size={18} />,
                  () => {
                    setDialog({ kind: "summary" });
                  },
                )}
                {headerButton(
                  t("diary.openBodyStats"),
                  <Scale aria-hidden size={18} />,
                  () => {
                    setDialog({ kind: "bodyStats" });
                  },
                )}
                {isWide &&
                  headerButton(
                    t(isRailPinned ? "diary.rail.hide" : "diary.rail.show"),
                    isRailPinned ? (
                      <PanelRightClose aria-hidden size={18} />
                    ) : (
                      <PanelRight aria-hidden size={18} />
                    ),
                    () => {
                      if (isRailPinned) setRailMode("hidden");
                      else setIsRailOpen(true);
                    },
                  )}
              </>
            )}
          </Row>
        </Row>

        {isWide && (
          <WeekStrip
            date={date}
            revision={state.revision}
            goal={goal}
            onSelect={onSelectDate}
            onDropMeal={(meal, target) => {
              setDialog({ kind: "copyMeal", meal, date: target });
            }}
          />
        )}

        {state.error && (
          <Banner
            text={t("common.loadError")}
            actionText={t("common.retry")}
            onAction={state.reload}
          />
        )}

        {!day && !state.error && (
          <Stack align="center" padding={6}>
            <Spinner label={t("common.loading")} />
          </Stack>
        )}

        {day && isLoaded && (
          <>
            {settings.diaryShowCompletion && (
              <CompletionBar
                day={day}
                mealCount={settings.mealNames.length}
                dayLabel={dayLabel}
                onToggle={() => void actions.toggleDay()}
              />
            )}
            <div
              className={
                isRailPinned
                  ? "grid grid-cols-[minmax(0,1fr)_22.5rem] items-start gap-4"
                  : undefined
              }
            >
              <Stack gap={3}>
                {settings.fastingEnabled && <FastingWidget />}
                {isWide ? (
                  <div className="grid grid-cols-2 items-start gap-3">
                    {[0, 1].map((column) => (
                      <Stack gap={3} key={column}>
                        {settings.mealNames.map((name, index) =>
                          index % 2 === column ? mealCard(name, index) : null,
                        )}
                      </Stack>
                    ))}
                  </div>
                ) : (
                  settings.mealNames.map(mealCard)
                )}
                {settings.diaryShowActivity && (
                  <ActivitySection
                    rows={goal.activity.data?.rows ?? []}
                    sum={goal.activity.data?.sum ?? null}
                    onAdd={() => {
                      setDialog({ kind: "activity" });
                    }}
                    onEdit={(activity) => {
                      setDialog({ kind: "activity", activity });
                    }}
                    onDelete={(row) => void actions.deleteActivity(row)}
                  />
                )}
                {settings.diaryShowNotes &&
                  !(isRailPinned && settings.diaryRailShowNotes) && (
                    <NotesCard
                      value={day.notes}
                      onSave={(text) => state.mutate(setNote(text))}
                    />
                  )}
              </Stack>
              {isRailPinned && (
                <aside aria-label={t("diary.rail.title")}>{rail}</aside>
              )}
            </div>
            <DiaryDialogs
              dialog={dialog}
              day={day}
              goal={goal}
              actions={actions}
              mutate={state.mutate}
              onClose={() => {
                setDialog(null);
              }}
            />
            {isRailOpen && isWide && !dialog && (
              <AppDialog
                title={t("diary.rail.title")}
                onClose={() => {
                  setIsRailOpen(false);
                }}
                confirmText={t("diary.rail.pin")}
                onConfirm={() => {
                  setRailMode("pinned");
                  setIsRailOpen(false);
                }}
              >
                {rail}
              </AppDialog>
            )}
          </>
        )}
      </div>
      {day && isLoaded && !isWide && <TotalsBar day={day} goal={goal} />}
    </div>
  );
}
