/**
 * The diary's exercise picker (old `ExercisePicker.svelte`): search,
 * category and equipment filters, a preview (a sheet on phones, a pane
 * beside the list on wide screens) and creating a custom exercise. It stays
 * open after a selection; closing is the caller's call.
 */
import {
  Button,
  Input,
  Pressable,
  Row,
  ScrollArea,
  Sheet,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useIsCompact } from "@monocircuit/monolithium/hooks";
import {
  CircleCheck,
  CirclePlus,
  Dumbbell,
  Info,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "../common/assets";
import { useResource } from "../common/useResource";
import {
  type Exercise,
  getExerciseHistory,
  getExercises,
} from "../exercises/api";
import { ExerciseEditor } from "../exercises/ExerciseEditor";
import { ExerciseInfo } from "../exercises/ExerciseInfo";
import { ExerciseInfoSheet } from "../exercises/ExerciseInfoSheet";
import { categoryLabel, equipmentLabel } from "../exercises/labels";
import { equipmentOptions, filterExercises } from "../lib/exerciseList";
import { exerciseRecord } from "../lib/exercisePr";
import {
  hasExactMatch,
  parseStoredFilters,
  toListFilters,
  type PickerFilters,
} from "../lib/pickerFilters";
import { CATEGORIES } from "../lib/workout";

export interface ExercisePickerSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: Exercise) => void;
}

/** The old picker's key: filters survive reopening during the session */
const FILTERS_KEY = "lt:picker-filters";
const COMPACT_ROW_LIMIT = 100;
const WIDE_ROW_LIMIT = 300;
const ADDED_FLASH_MS = 1500;

function readFilters(): PickerFilters {
  try {
    return parseStoredFilters(window.sessionStorage.getItem(FILTERS_KEY));
  } catch {
    return parseStoredFilters(null);
  }
}

function useStoredFilters() {
  const [filters, setFilters] = useState(readFilters);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      // Storage blocked: the filters just don't survive
    }
  }, [filters]);
  return [filters, setFilters] as const;
}

type Library =
  { status: "loading" | "error" } | { status: "ready"; exercises: Exercise[] };

function useLibrary() {
  const [library, setLibrary] = useState<Library>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    getExercises().then(
      (exercises) => {
        if (isCurrent) setLibrary({ status: "ready", exercises });
      },
      (error: unknown) => {
        console.error("[ExercisePickerSheet] loading failed", error);
        if (isCurrent) setLibrary({ status: "error" });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retry = () => {
    setLibrary({ status: "loading" });
    setAttempt((n) => n + 1);
  };
  const append = (exercise: Exercise) => {
    setLibrary((current) =>
      current.status === "ready"
        ? { status: "ready", exercises: [...current.exercises, exercise] }
        : { status: "ready", exercises: [exercise] },
    );
  };

  return { library, retry, append };
}

/** Which rows were just added (briefly) and added at all while open */
function useAddedRows() {
  const [recent, setRecent] = useState<ReadonlySet<number>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const mark = useCallback((id: number) => {
    setRecent((ids) => new Set(ids).add(id));
    setAdded((ids) => new Set(ids).add(id));
    window.clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      window.setTimeout(() => {
        setRecent((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        });
      }, ADDED_FLASH_MS),
    );
  }, []);

  return { recent, added, mark };
}

// ── Filter chips ───────────────────────────────────────────────────────────

interface FilterChip {
  id: string;
  text: string;
  isSelected: boolean;
  onPress: () => void;
}

/** One scrolling line on phones, wrapping lines on wide screens */
function FilterChips({
  label,
  chips,
  isCompact,
}: {
  label: string;
  chips: FilterChip[];
  isCompact: boolean;
}) {
  const [line, setLine] = useState<HTMLElement | null>(null);

  // A mouse wheel moves along the line (React's onWheel can't preventDefault)
  useEffect(() => {
    if (!line) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      line.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    line.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      line.removeEventListener("wheel", onWheel);
    };
  }, [line]);

  const buttons = chips.map((chip) => (
    <Button
      key={chip.id}
      size="sm"
      className="shrink-0"
      variant={chip.isSelected ? "primary" : "secondary"}
      aria-pressed={chip.isSelected}
      text={chip.text}
      onClick={chip.onPress}
    />
  ));

  return isCompact ? (
    <ScrollArea
      ref={setLine}
      direction="horizontal"
      shouldGrow={false}
      gap={2}
      role="group"
      aria-label={label}
      className="shrink-0 [scrollbar-width:none]"
    >
      {buttons}
    </ScrollArea>
  ) : (
    <Row gap={2} shouldWrap role="group" aria-label={label}>
      {buttons}
    </Row>
  );
}

// ── Rows ───────────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  isCompact,
  isJustAdded,
  isAdded,
  isPreviewed,
  onSelect,
  onInfo,
}: {
  exercise: Exercise;
  isCompact: boolean;
  isJustAdded: boolean;
  isAdded: boolean;
  isPreviewed: boolean;
  onSelect: () => void;
  onInfo: () => void;
}) {
  const { t } = useTranslation("training");
  const categoryText = exercise.category
    ? categoryLabel(t, exercise.category)
    : t("picker.uncategorized");
  const equipment = (exercise.equipment ?? [])
    .map((item) => equipmentLabel(t, item))
    .join(", ");
  const meta = equipment ? `${categoryText} · ${equipment}` : categoryText;
  const image = exercise.gif_url || exercise.img_url;

  return (
    <li
      className={`flex shrink-0 items-center gap-1 rounded-container border pr-1 ${
        isPreviewed ? "border-accent" : "border-border"
      } ${isJustAdded || isAdded ? "bg-accent/10" : "bg-level-1"}`}
    >
      <Pressable
        label={t("picker.addExercise", { name: exercise.name })}
        onPress={onSelect}
        className="min-w-0 flex-1"
      >
        <span className="flex min-w-0 items-center gap-3 p-3">
          {isCompact ? null : (
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-control bg-bg">
              {image ? (
                <img
                  className="size-full object-cover"
                  src={ltAssetUrl(image)}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <Dumbbell aria-hidden className="size-5 text-muted" />
              )}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <Text as="span" variant="small">
              {exercise.name}
            </Text>
            <Text
              as="span"
              variant="caption"
              tone="muted"
              isTruncated
              className="capitalize"
            >
              {meta}
            </Text>
          </span>
          {isJustAdded ? null : isAdded ? (
            <CircleCheck aria-hidden className="size-5 shrink-0 opacity-70" />
          ) : (
            <CirclePlus aria-hidden className="size-6 shrink-0" />
          )}
        </span>
      </Pressable>
      {/* Outside the button, whose label would hide them from readers */}
      {isJustAdded ? (
        <Text as="span" variant="caption" role="status" className="shrink-0">
          {t("picker.added")}
        </Text>
      ) : isAdded ? (
        <span className="sr-only">{t("picker.alreadyAdded")}</span>
      ) : null}
      <Button
        size="md"
        aria-label={t("picker.viewDetails", { name: exercise.name })}
        onClick={onInfo}
      >
        <Info aria-hidden className="size-5" />
      </Button>
    </li>
  );
}

// ── The wide layout's preview pane ─────────────────────────────────────────

function PreviewPane({
  exercise,
  onClose,
  onAdd,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
}) {
  const { t } = useTranslation("training");
  const id = exercise?.id ?? null;
  const { data: history, error } = useResource(String(id), () =>
    id === null ? Promise.resolve([]) : getExerciseHistory(id),
  );
  const sessions = history ?? (error ? [] : null);

  return (
    <aside
      aria-label={t("picker.preview")}
      className="flex min-h-0 w-1/2 max-w-96 flex-col gap-3 overflow-hidden rounded-container border border-border bg-level-1 p-4"
    >
      {exercise ? (
        <>
          <Row gap={2} align="center" justify="between">
            <Text as="h3" variant="heading" isTruncated className="min-w-0">
              {exercise.name}
            </Text>
            <Button
              size="sm"
              aria-label={t("picker.closePreview")}
              onClick={onClose}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </Row>
          {sessions === null ? (
            <Spinner aria-label={t("picker.loading")} />
          ) : (
            <ScrollArea scrollbar="thin">
              <ExerciseInfo
                exercise={exercise}
                record={exerciseRecord(sessions)}
                history={sessions}
              />
            </ScrollArea>
          )}
          <Button
            variant="primary"
            size="lg"
            isFullWidth
            className="shrink-0"
            text={t("picker.addToWorkout")}
            onClick={() => {
              onAdd(exercise);
            }}
          >
            <CirclePlus aria-hidden className="size-4" />
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Info aria-hidden className="size-8 text-muted" />
          <Text as="p" variant="small">
            {t("picker.previewEmptyTitle")}
          </Text>
          <Text as="p" variant="caption" tone="muted">
            {t("picker.previewEmptyText")}
          </Text>
        </div>
      )}
    </aside>
  );
}

// ── The picker ─────────────────────────────────────────────────────────────

/** Mounted with the open sheet, so what was added resets on closing */
function PickerContent({
  onSelect,
}: {
  onSelect: (exercise: Exercise) => void;
}) {
  const { t } = useTranslation("training");
  const isCompact = useIsCompact();
  const { library, retry, append } = useLibrary();
  const [filters, setFilters] = useStoredFilters();
  const { recent, added, mark } = useAddedRows();
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [info, setInfo] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });
  const [creator, setCreator] = useState({ isOpen: false, name: "" });

  const exercises = library.status === "ready" ? library.exercises : [];
  const listFilters = toListFilters(filters);
  const rows = filterExercises(exercises, listFilters).slice(
    0,
    isCompact ? COMPACT_ROW_LIMIT : WIDE_ROW_LIMIT,
  );
  const options = equipmentOptions(exercises, listFilters, []);
  // A chosen bucket the search emptied stays visible, so it can be undone
  const isChoiceMissing =
    filters.equipment !== "" &&
    !options.some((option) => option.name === filters.equipment);
  const equipmentChips = [
    ...options,
    ...(isChoiceMissing ? [{ name: filters.equipment, count: 0 }] : []),
  ];
  const search = filters.search.trim();

  const select = (exercise: Exercise) => {
    onSelect(exercise);
    mark(exercise.id);
  };
  const openCreator = () => {
    setCreator({ isOpen: true, name: search });
  };
  const pickCategory = (category: string) => {
    // Another category starts with all of its equipment
    if (category !== filters.category) {
      setFilters({ ...filters, category, equipment: "" });
    }
  };
  const pickEquipment = (equipment: string) => {
    setFilters({
      ...filters,
      equipment: filters.equipment === equipment ? "" : equipment,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <Input
        autoFocus
        icon={<Search aria-hidden className="size-4" />}
        aria-label={t("picker.searchLabel")}
        placeholder={t("picker.searchPlaceholder")}
        value={filters.search}
        onValueChange={(value) => {
          setFilters({ ...filters, search: value });
        }}
      />
      <FilterChips
        isCompact={isCompact}
        label={t("picker.categoryFilter")}
        chips={["", ...CATEGORIES].map((id) => ({
          id: id || "all",
          text: id ? categoryLabel(t, id) : t("picker.all"),
          isSelected: filters.category === id,
          onPress: () => {
            pickCategory(id);
          },
        }))}
      />
      {options.length > 1 || filters.equipment ? (
        <FilterChips
          isCompact={isCompact}
          label={t("picker.equipmentFilter")}
          chips={[
            {
              id: "all",
              text: t("picker.allEquipment"),
              isSelected: !filters.equipment,
              onPress: () => {
                setFilters({ ...filters, equipment: "" });
              },
            },
            ...equipmentChips.map((option) => ({
              id: option.name,
              text: t("picker.equipmentCount", {
                name: equipmentLabel(t, option.name),
                count: option.count,
              }),
              isSelected: filters.equipment === option.name,
              onPress: () => {
                pickEquipment(option.name);
              },
            })),
          ]}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 gap-4">
        <ScrollArea gap={2} className="min-w-0 flex-1">
          {library.status === "loading" ? (
            <Stack align="center" gap={2}>
              <Spinner aria-hidden />
              <Text as="p" variant="small" tone="muted">
                {t("picker.loading")}
              </Text>
            </Stack>
          ) : library.status === "error" ? (
            <Stack align="center" gap={3}>
              <Text as="p" variant="small" tone="muted">
                {t("picker.loadError")}
              </Text>
              <Button
                variant="secondary"
                size="md"
                text={t("picker.retry")}
                onClick={retry}
              />
            </Stack>
          ) : rows.length === 0 ? (
            <Stack align="center" gap={3}>
              <Text as="p" variant="small" tone="muted">
                {search
                  ? t("picker.noMatchesFor", { search })
                  : t("picker.noMatches")}
              </Text>
              {search ? (
                <Button
                  variant="primary"
                  size="md"
                  text={t("picker.create", { name: search })}
                  onClick={openCreator}
                >
                  <Plus aria-hidden className="size-4" />
                </Button>
              ) : null}
            </Stack>
          ) : (
            <>
              {search && !hasExactMatch(rows, search) ? (
                <Stack gap={1} className="shrink-0">
                  <Button
                    variant="secondary"
                    size="lg"
                    isFullWidth
                    text={t("picker.create", { name: search })}
                    onClick={openCreator}
                  >
                    <CirclePlus aria-hidden className="size-5" />
                  </Button>
                  <Text as="p" variant="caption" tone="muted">
                    {t("picker.createHint")}
                  </Text>
                </Stack>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {rows.map((exercise) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    isCompact={isCompact}
                    isJustAdded={recent.has(exercise.id)}
                    isAdded={added.has(exercise.id)}
                    isPreviewed={!isCompact && preview?.id === exercise.id}
                    onSelect={() => {
                      select(exercise);
                    }}
                    onInfo={() => {
                      if (isCompact) {
                        setInfo({ isOpen: true, id: exercise.id });
                      } else {
                        setPreview(exercise);
                      }
                    }}
                  />
                ))}
              </ul>
            </>
          )}
        </ScrollArea>
        {isCompact ? null : (
          <PreviewPane
            exercise={preview}
            onClose={() => {
              setPreview(null);
            }}
            onAdd={select}
          />
        )}
      </div>

      <ExerciseInfoSheet
        isOpen={info.isOpen}
        onClose={() => {
          setInfo((v) => ({ ...v, isOpen: false }));
        }}
        exerciseId={info.id}
        onAdd={select}
      />
      <ExerciseEditor
        isOpen={creator.isOpen}
        onClose={() => {
          setCreator((v) => ({ ...v, isOpen: false }));
        }}
        prefillName={creator.name}
        onSaved={(exercise) => {
          append(exercise);
          select(exercise);
        }}
      />
    </div>
  );
}

export function ExercisePickerSheet({
  isOpen,
  onOpenChange,
  onSelect,
}: ExercisePickerSheetProps) {
  const { t } = useTranslation("training");
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("picker.title")}
      snapPoints={[0.95]}
      isFlush
    >
      <PickerContent onSelect={onSelect} />
    </Sheet>
  );
}
