import {
  Button,
  Chip,
  Dialog,
  FileInput,
  Input,
  Menu,
  Pressable,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import type { TFunction } from "i18next";
import {
  ArrowDownAZ,
  ChevronRight,
  Dumbbell,
  Info,
  LayoutGrid,
  List,
  Plus,
  Search,
  SearchX,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { ltAssetUrl } from "../common/assets";
import { LoadFailed, Loading } from "../common/LoadState";
import { ToggleChips } from "../common/ToggleChips";
import { useMediaQuery, WIDE_QUERY } from "../common/useMediaQuery";
import { useResource } from "../common/useResource";
import {
  categoryCounts,
  equipmentOptions,
  filterExercises,
  formatRelativeAge,
  groupExercises,
  relativeAge,
  SORT_MODES,
  type SortMode,
  type UsageById,
} from "../lib/exerciseList";
import { exerciseRecord } from "../lib/exercisePr";
import {
  fetchSharedExercise,
  parseSharePayload,
  type PortableExercise,
  ShareError,
} from "../lib/exerciseShare";
import { CATEGORIES } from "../lib/workout";
import {
  createExercise,
  type Exercise,
  getExerciseHistory,
  getExercises,
  getExerciseUsage,
} from "./api";
import { ExerciseEditor } from "./ExerciseEditor";
import { ExerciseInfo } from "./ExerciseInfo";
import { categoryLabel, equipmentLabel, muscleLabel } from "./labels";
import { shareErrorText } from "./shareErrorText";

const EQUIPMENT_KEY = "trace.lt.exEquip";
const SORT_KEY = "trace.lt.exSort";

function readSession<V>(key: string, fallback: V, isValid: (v: V) => boolean) {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw) as V;
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // blocked storage: the choice lasts as long as the screen
  }
}

async function loadLibrary(): Promise<{
  exercises: Exercise[];
  usage: UsageById;
}> {
  const [exercises, usage] = await Promise.all([
    getExercises(),
    getExerciseUsage().catch((): UsageById => ({})),
  ]);
  return { exercises, usage };
}

/** /training/exercises: the exercise library */
export function ExercisesPage() {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const isWide = useMediaQuery(WIDE_QUERY);
  const library = useResource("exercises", loadLibrary);
  const [favoriteSetting, setFavorites] = useSetting("lt", "favoriteExercises");
  const favorites = favoriteSetting as number[];
  const [customEquipment] = useSetting("lt", "customEquipment");
  const [density, setDensity] = useSetting("lt", "exerciseBrowserDensity");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipmentState] = useState<string[]>(() =>
    readSession<string[]>(EQUIPMENT_KEY, [], Array.isArray),
  );
  const [sort, setSortState] = useState<SortMode>(() =>
    readSession<SortMode>(SORT_KEY, "alpha", (v) => SORT_MODES.includes(v)),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [importFrom, setImportFrom] = useState<"file" | "url" | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const setEquipment = (next: string[]) => {
    setEquipmentState(next);
    writeSession(EQUIPMENT_KEY, next);
  };
  const setSort = (next: SortMode) => {
    setSortState(next);
    writeSession(SORT_KEY, next);
  };

  const exercises = library.data?.exercises ?? [];
  const usage = library.data?.usage ?? {};
  const filters = { search, category, equipment };
  const filtered = filterExercises(exercises, filters);
  const counts = categoryCounts(exercises, filters);
  const chips = equipmentOptions(
    exercises,
    filters,
    customEquipment as string[],
  );
  const groups = groupExercises(filtered, sort, category, usage, favorites);
  const preview = exercises.find((e) => e.id === previewId) ?? null;
  const isComfortable = isWide && density === "comfortable";

  const importExercise = async (read: () => Promise<PortableExercise>) => {
    setImportFrom(null);
    setIsImporting(true);
    try {
      const created = await createExercise(await read());
      toast.info(t("exercises.import.done", { name: created.name }));
      library.reload();
    } catch (error) {
      toast.error(
        error instanceof ShareError
          ? shareErrorText(t, error)
          : t("common.error", { message: (error as Error).message }),
      );
    } finally {
      setIsImporting(false);
    }
  };

  const toggleFavorite = (id: number) => {
    setFavorites(
      favorites.includes(id)
        ? favorites.filter((entry) => entry !== id)
        : [...favorites, id],
    );
  };

  const open = (exercise: Exercise) => {
    if (isWide) setPreviewId(exercise.id);
    else void navigate(`/training/exercises/${exercise.id}`);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      <Row gap={3} align="center" justify="between">
        <Row gap={2} align="baseline">
          <Text variant="title" as="h1">
            {t("exercises.title")}
          </Text>
          {library.data && (
            <Text variant="small" tone="muted">
              {filtered.length === exercises.length
                ? exercises.length
                : `${filtered.length} / ${exercises.length}`}
            </Text>
          )}
        </Row>
        <Menu
          label={t("exercises.add")}
          align="end"
          items={[
            {
              id: "create",
              text: t("exercises.createNew"),
              onSelect: () => {
                setIsCreating(true);
              },
            },
            {
              id: "file",
              text: t("exercises.import.file"),
              onSelect: () => {
                setImportFrom("file");
              },
            },
            {
              id: "url",
              text: t("exercises.import.url"),
              onSelect: () => {
                setImportFrom("url");
              },
            },
          ]}
        >
          <Button
            variant="primary"
            aria-label={t("exercises.add")}
            isLoading={isImporting}
          >
            <Plus aria-hidden size={20} />
          </Button>
        </Menu>
      </Row>

      <Row gap={2} align="center">
        <div className="min-w-0 flex-1">
          <Input
            type="search"
            aria-label={t("exercises.search")}
            placeholder={t("exercises.search")}
            icon={<Search aria-hidden size={16} />}
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <Menu
          label={t("exercises.sort.label")}
          align="end"
          items={SORT_MODES.map((mode) => ({
            id: mode,
            text: t(`exercises.sort.${mode}`),
            isChecked: sort === mode,
            onSelect: () => {
              setSort(mode);
            },
          }))}
        >
          <Button
            variant={sort === "alpha" ? "secondary" : "primary"}
            aria-label={t("exercises.sort.label")}
          >
            <ArrowDownAZ aria-hidden size={18} />
          </Button>
        </Menu>
        {isWide && (
          <Button
            variant="secondary"
            aria-label={t(
              density === "compact"
                ? "exercises.densityComfortable"
                : "exercises.densityCompact",
            )}
            onClick={() => {
              setDensity(density === "compact" ? "comfortable" : "compact");
            }}
          >
            {density === "compact" ? (
              <LayoutGrid aria-hidden size={18} />
            ) : (
              <List aria-hidden size={18} />
            )}
          </Button>
        )}
      </Row>

      <ToggleChips
        isScrolling
        label={t("exercises.categoryFilter")}
        options={[
          { value: "", label: t("exercises.all") },
          ...CATEGORIES.filter((id) => counts.has(id) || id === category).map(
            (id) => ({ value: id, label: categoryLabel(t, id) }),
          ),
        ]}
        selected={[category]}
        onToggle={setCategory}
      />
      {chips.length > 1 && (
        <ToggleChips
          isScrolling
          label={t("exercises.equipmentFilter")}
          options={[
            { value: "", label: t("exercises.allEquipment") },
            ...chips.map((chip) => ({
              value: chip.name,
              label: `${chip.isCustom ? chip.name : equipmentLabel(t, chip.name)} · ${chip.count}`,
            })),
          ]}
          selected={equipment.length ? equipment : [""]}
          onToggle={(value) => {
            if (!value) setEquipment([]);
            else {
              setEquipment(
                equipment.includes(value)
                  ? equipment.filter((entry) => entry !== value)
                  : [...equipment, value],
              );
            }
          }}
        />
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {library.error && !library.data ? (
            <LoadFailed error={library.error} onRetry={library.reload} />
          ) : !library.data ? (
            <Loading />
          ) : exercises.length === 0 ? (
            <EmptyNote
              icon={<Dumbbell aria-hidden />}
              text={t("exercises.emptyLibrary")}
              action={{
                text: t("exercises.openSettings"),
                onClick: () => void navigate("/settings"),
              }}
            />
          ) : filtered.length === 0 ? (
            <EmptyNote
              icon={<SearchX aria-hidden />}
              text={t("exercises.noMatch")}
              action={{
                text: t("exercises.clearFilters"),
                onClick: () => {
                  setSearch("");
                  setCategory("");
                  setEquipment([]);
                },
              }}
            />
          ) : (
            <Stack gap={4}>
              {groups.map((group) => (
                <Stack key={group.category || "all"} gap={1}>
                  {group.category && (
                    <Text variant="label" tone="muted" as="h2">
                      {categoryLabel(t, group.category)}
                    </Text>
                  )}
                  <ul className="flex flex-col gap-1">
                    {group.exercises.map((exercise) => (
                      <ExerciseRow
                        key={exercise.id}
                        t={t}
                        language={i18n.language}
                        exercise={exercise}
                        lastDate={usage[exercise.id]?.last_date}
                        isFavorite={favorites.includes(exercise.id)}
                        isSelected={isWide && previewId === exercise.id}
                        isComfortable={isComfortable}
                        onOpen={open}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </ul>
                </Stack>
              ))}
            </Stack>
          )}
        </div>
        {isWide && (
          <aside
            aria-label={t("exercises.preview.label")}
            className="sticky top-16 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-container border border-border bg-level-1 p-4"
          >
            {preview ? (
              <Preview
                key={preview.id}
                exercise={preview}
                onClose={() => {
                  setPreviewId(null);
                }}
              />
            ) : (
              <EmptyNote
                icon={<Info aria-hidden />}
                text={t("exercises.preview.empty")}
              />
            )}
          </aside>
        )}
      </div>

      <ExerciseEditor
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
        }}
        onSaved={library.reload}
      />
      <ImportDialog
        source={importFrom}
        onClose={() => {
          setImportFrom(null);
        }}
        onImport={(read) => void importExercise(read)}
      />
    </div>
  );
}

interface ExerciseRowProps {
  t: TFunction<"training">;
  language: string;
  exercise: Exercise;
  lastDate?: string | null;
  isFavorite: boolean;
  isSelected: boolean;
  isComfortable: boolean;
  onOpen: (exercise: Exercise) => void;
  onToggleFavorite: (id: number) => void;
}

function ExerciseRow({
  t,
  language,
  exercise,
  lastDate,
  isFavorite,
  isSelected,
  isComfortable,
  onOpen,
  onToggleFavorite,
}: ExerciseRowProps) {
  const image = exercise.gif_url || exercise.img_url;
  const meta = [
    (exercise.equipment ?? []).map((e) => equipmentLabel(t, e)).join(", "),
    (exercise.primary_muscles ?? [])
      .slice(0, 2)
      .map((m) => muscleLabel(t, m))
      .join(", "),
    lastDate ? formatRelativeAge(relativeAge(lastDate), language) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const size = isComfortable ? "size-24" : "size-12";

  return (
    <li
      className={`flex items-center gap-1 rounded-container border bg-level-1 [contain-intrinsic-size:auto_4.25rem] [content-visibility:auto] ${isSelected ? "border-accent" : "border-border"}`}
    >
      <Button
        aria-label={t(
          isFavorite ? "exercises.unfavorite" : "exercises.favorite",
          { name: exercise.name },
        )}
        aria-pressed={isFavorite}
        onClick={() => {
          onToggleFavorite(exercise.id);
        }}
      >
        <Star
          aria-hidden
          size={18}
          className={isFavorite ? "fill-current text-accent" : "text-muted"}
        />
      </Button>
      <Pressable
        className="min-w-0 flex-1 p-2 text-left"
        label={exercise.name}
        onPress={() => {
          onOpen(exercise);
        }}
      >
        <Row gap={3} align="center" className="min-w-0">
          <div
            className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-level-2`}
          >
            {image ? (
              <img
                className="size-full object-cover"
                src={ltAssetUrl(image)}
                alt=""
                loading="lazy"
              />
            ) : (
              <Dumbbell aria-hidden size={20} className="text-muted" />
            )}
          </div>
          <Stack gap={0} className="min-w-0 flex-1">
            <Row gap={2} align="center" className="min-w-0">
              <Text isTruncated={!isComfortable}>{exercise.name}</Text>
              {exercise.source === "custom" && !exercise.is_global && (
                <Chip tone="muted" text={t("exercises.custom")} />
              )}
            </Row>
            <Text variant="caption" tone="muted" isTruncated={!isComfortable}>
              {meta}
            </Text>
          </Stack>
          <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
        </Row>
      </Pressable>
    </li>
  );
}

function Preview({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const history = useResource(`history-${exercise.id}`, () =>
    getExerciseHistory(exercise.id).catch(() => []),
  );
  return (
    <Stack gap={3}>
      <Row gap={2} justify="between" align="center">
        <Text variant="heading" as="h2">
          {exercise.name}
        </Text>
        <Button aria-label={t("exercises.preview.close")} onClick={onClose}>
          <X aria-hidden size={18} />
        </Button>
      </Row>
      {history.data ? (
        <ExerciseInfo
          exercise={exercise}
          record={exerciseRecord(history.data)}
          history={history.data}
        />
      ) : (
        <Loading />
      )}
      <Button
        variant="primary"
        isFullWidth
        text={t("exercises.preview.full")}
        onClick={() => void navigate(`/training/exercises/${exercise.id}`)}
      />
    </Stack>
  );
}

interface ImportDialogProps {
  source: "file" | "url" | null;
  onClose: () => void;
  onImport: (read: () => Promise<PortableExercise>) => void;
}

function ImportDialog({ source, onClose, onImport }: ImportDialogProps) {
  const { t } = useTranslation("training");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const close = () => {
    setUrl("");
    setFile(null);
    onClose();
  };
  const confirm = () => {
    if (source === "file" && file) {
      onImport(async () => parseSharePayload(await file.text()));
    } else if (source === "url" && url.trim()) {
      onImport(() => fetchSharedExercise(url));
    } else return;
    setUrl("");
    setFile(null);
  };
  return (
    <Dialog
      open={source !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) close();
      }}
      title={
        source === "url"
          ? t("exercises.import.urlTitle")
          : t("exercises.import.fileTitle")
      }
      description={
        source === "url"
          ? t("exercises.import.urlText")
          : t("exercises.import.fileText")
      }
      confirmText={t("exercises.import.action")}
      cancelText={t("common.cancel")}
      isConfirmDisabled={source === "url" ? !url.trim() : !file}
      onConfirm={confirm}
    >
      {source === "url" ? (
        <Input
          type="url"
          aria-label={t("exercises.import.urlTitle")}
          placeholder="https://raw.githubusercontent.com/..."
          value={url}
          onValueChange={setUrl}
          onEnter={confirm}
          autoFocus
        />
      ) : (
        <FileInput
          accept="application/json,.json"
          text={t("exercises.import.chooseFile")}
          placeholder={t("exercises.import.noFile")}
          file={file}
          onChange={setFile}
        />
      )}
    </Dialog>
  );
}
