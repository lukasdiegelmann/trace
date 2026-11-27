import {
  Banner,
  Box,
  Button,
  DisabledScope,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeft,
  Heart,
  Link2,
  Link2Off,
  Plus,
  ScanBarcode,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";

import { foodsApi, proxyGet, type FoodRow } from "../api";
import { DecimalField } from "../components/DecimalField";
import { UnitPicker } from "../components/UnitPicker";
import { useNotify } from "../components/useNotify";
import { addToDiary, mutateDiaryDay } from "../diaryStore";
import { diaryPath, type FoodEditorState } from "../editorLinks";
import { PhotoField } from "../editor/PhotoField";
import { useDraftForm } from "../editor/useDraftForm";
import { useLeaveEditor } from "../editor/useLeaveEditor";
import { offOptions } from "../foods/sourceConfig";
import { ScannerDialog } from "../foods/ScannerDialog";
import { newDiaryItem, removeItems } from "../lib/diary";
import { draftKey } from "../lib/editorDraft";
import { categoryDisplay, categoryName } from "../lib/foodSearch";
import {
  addAltUnitRow,
  altUnitsFromRows,
  applyOffPrepared,
  applyOffRefresh,
  emptyFoodForm,
  findDuplicateBarcode,
  foodFormFromExternal,
  foodFormFromRow,
  foodFormToWrite,
  isFoodFormBlank,
  offValuesOf,
  removeAltUnitRow,
  scaleToPortion,
  shouldShowUnitMetadata,
  shouldStartLinked,
  takeScaleSnapshot,
  toggleNutritionBasis,
  updateAltUnitRow,
  validateFoodForm,
  type FoodFormState,
  type ScaleSnapshot,
} from "../lib/foodForm";
import { applyLabel } from "../lib/labelScan";
import { diarySource, loggableFood, storedAmount } from "../lib/pickItems";
import { hydrateOffHit, lookupBarcode } from "../lib/sources/openFoodFacts";
import {
  needsFullLookup,
  offNotice,
  type OffNotice,
} from "../lib/sources/offStatus";
import { useNtSettings, type NtSettings } from "../settings";
import { useResource } from "../useResource";
import { NutrientInputs } from "./NutrientInputs";
import { OffActions, OffNoticeBanner } from "./OffActions";
import { ScanLabelButton } from "./ScanLabelButton";

export function FoodEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const { isLoaded } = useNtSettings();
  const state = (location.state ?? {}) as FoodEditorState;
  if (!isLoaded) return <Loading />;
  // A new key per food: form, draft and notices start over
  return (
    <FoodEditor
      key={`${id ?? "new"}-${location.key}`}
      id={id ? Number(id) : null}
      state={state}
    />
  );
}

function Loading() {
  const { t } = useTranslation("nutrition");
  return (
    <Stack align="center" padding={6}>
      <Spinner label={t("common.loading")} />
    </Stack>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Box surface="surface" border="all" radius="lg" padding={4}>
      <Stack gap={3}>
        {title && (
          <Text variant="heading" as="h2">
            {title}
          </Text>
        )}
        {children}
      </Stack>
    </Box>
  );
}

async function loadForm(
  id: number | null,
  state: FoodEditorState,
  settings: NtSettings,
  onNotice: (notice: OffNotice | null) => void,
  onRow: (row: FoodRow) => void,
): Promise<FoodFormState> {
  // A prefill wins over the id, as upstream
  let prefill = state.prefill;
  if (prefill) {
    if (prefill.source === "off" && prefill.barcode) {
      if (needsFullLookup(prefill.offInfo)) {
        prefill = await hydrateOffHit(proxyGet, prefill, offOptions(settings));
      }
      onNotice(offNotice(prefill.barcode, prefill.offInfo));
    }
    return foodFormFromExternal(prefill);
  }
  if (id !== null) {
    const row = await foodsApi.get(id);
    onRow(row);
    return foodFormFromRow(row);
  }
  return emptyFoodForm({ barcode: state.barcode ?? "" });
}

function FoodEditor({
  id,
  state,
}: {
  id: number | null;
  state: FoodEditorState;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const { sessions } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const leave = useLeaveEditor();
  const userId =
    sessions?.nt.state === "signed-in" ? sessions.nt.user.id : null;

  const [notice, setNotice] = useState<OffNotice | null>(null);
  const [owner, setOwner] = useState<number | null>(null);
  const [key] = useState(() =>
    draftKey("food", id, state.prefill ?? null, userId),
  );
  const draft = useDraftForm(
    key,
    () =>
      loadForm(id, state, settings, setNotice, (row) => {
        setOwner(row.user_id);
      }),
    state.prefill?.barcode ?? state.barcode ?? null,
  );
  const { form, change } = draft;
  const library = useResource("editor-foods", () => foodsApi.list());
  const [isBusy, setIsBusy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // The link: nutrients follow the serving size from the moment it is on.
  // A food with values starts linked, an empty one doesn't.
  const [isLinkedAtStart, setLinkedAtStart] = useState<boolean | null>(null);
  const [isLinkChosen, setLinkChosen] = useState<boolean | null>(null);
  if (form && isLinkedAtStart === null) {
    setLinkedAtStart(shouldStartLinked(form));
  }
  const isLinked = isLinkChosen ?? isLinkedAtStart ?? false;
  const snapshot = useRef<ScaleSnapshot | null>(null);
  const scaleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(scaleTimer.current);
    },
    [],
  );

  if (draft.error) {
    return (
      <Stack gap={3} padding={4}>
        <Banner
          text={t("editor.loadFailed", { message: draft.error.message })}
        />
        <Button variant="secondary" text={t("editor.back")} onClick={leave} />
      </Stack>
    );
  }
  if (!form) return <Loading />;

  const isReadOnly =
    form.sharedBy !== null ||
    (owner !== null && userId !== null && owner !== userId);
  const set = (changes: Partial<FoodFormState>) => {
    change((current) => ({ ...current, ...changes }));
  };

  const setPortion = (portion: string) => {
    if (isLinked) snapshot.current ??= takeScaleSnapshot(form);
    set({ portion });
    clearTimeout(scaleTimer.current);
    const from = snapshot.current;
    if (isLinked && from) {
      scaleTimer.current = setTimeout(() => {
        change((current) => scaleToPortion(current, from));
      }, 400);
    }
  };
  const toggleLink = () => {
    clearTimeout(scaleTimer.current);
    snapshot.current = isLinked ? null : takeScaleSnapshot(form);
    setLinkChosen(!isLinked);
  };
  const changeNutrients = (next: (current: FoodFormState) => FoodFormState) => {
    // A typed value becomes the new basis of the scaling
    snapshot.current = null;
    change(next);
  };

  const scanned = async (code: string) => {
    setIsScanning(false);
    const isBlank = isFoodFormBlank(form);
    set({ barcode: code });
    if (!isBlank || !settings.offEnabled) {
      notify.success(t("foodEditor.barcodeSet"));
      return;
    }
    try {
      const food = await lookupBarcode(proxyGet, code, {
        ...offOptions(settings),
        isLive: true,
      });
      if (!food) {
        notify.info(t("foodEditor.off.notFound"));
        return;
      }
      change((current) => applyOffRefresh(current, offValuesOf(food)).form);
      setNotice(offNotice(code, food.offInfo));
    } catch (caught) {
      notify.error(
        t("foodEditor.off.failed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    }
  };

  const save = async () => {
    if (isBusy) return;
    if (validateFoodForm(form).length > 0) {
      notify.error(t("editor.nameRequired"));
      return;
    }
    setIsBusy(true);
    try {
      const write = foodFormToWrite(form, settings.customNutriments);
      const saved =
        form.id === null
          ? await foodsApi.create(write)
          : await foodsApi.update(form.id, write);
      draft.forget();
      if (state.pick) {
        // The saved row may be an older one the server matched by barcode
        const loggable = loggableFood(saved);
        await addToDiary(state.pick.date, [
          newDiaryItem(
            diarySource(loggable, storedAmount(loggable)),
            state.pick.meal,
          ),
        ]);
        if (state.pick.replace) {
          await mutateDiaryDay(
            state.pick.date,
            removeItems([state.pick.replace]),
          );
        }
        notify.success(t("foodEditor.addedToDiary"));
        await navigate(diaryPath(state.pick.date), { replace: true });
        return;
      }
      notify.success(t("editor.saved"));
      leave();
    } catch (caught) {
      notify.error(
        t("editor.saveFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
      setIsBusy(false);
    }
  };

  const copyShared = async () => {
    setIsBusy(true);
    try {
      if (form.id !== null) await foodsApi.copy(form.id);
      else {
        await foodsApi.create(
          foodFormToWrite({ ...form, id: null }, settings.customNutriments),
        );
      }
      draft.forget();
      notify.success(t("foods.toast.savedToCatalog"));
      leave();
    } catch (caught) {
      notify.failure(caught);
      setIsBusy(false);
    }
  };

  const duplicate = findDuplicateBarcode(library.data ?? [], form);
  const shouldShowMetadata = shouldShowUnitMetadata(form, settings);
  const title = isReadOnly
    ? form.sharedBy
      ? t("editor.shared.title", { name: form.sharedBy })
      : t("editor.shared.unnamed")
    : t(form.id === null ? "foodEditor.newTitle" : "foodEditor.editTitle");

  return (
    <Stack gap={3} padding={4} maxWidth="2xl" isCentered fill="width">
      <Row gap={2} align="center" justify="between">
        <Button size="sm" aria-label={t("editor.back")} onClick={leave}>
          <ArrowLeft aria-hidden size={18} />
        </Button>
        <Box shouldGrow>
          <Text variant="title" as="h1" isTruncated>
            {title}
          </Text>
        </Box>
        {form.id !== null && !isReadOnly && (
          <Button
            size="sm"
            aria-label={t(
              form.isFavorite
                ? "editor.favorite.remove"
                : "editor.favorite.add",
            )}
            aria-pressed={form.isFavorite}
            onClick={() => {
              set({ isFavorite: !form.isFavorite });
            }}
          >
            <Heart
              aria-hidden
              size={18}
              fill={form.isFavorite ? "currentColor" : "none"}
            />
          </Button>
        )}
        {!isReadOnly && (
          <Button
            size="md"
            variant="primary"
            text={t("editor.save")}
            isLoading={isBusy}
            onClick={() => void save()}
          />
        )}
      </Row>

      {isReadOnly && (
        <>
          <Banner text={t("editor.shared.readOnly")} />
          <Button
            variant="primary"
            size="lg"
            text={t("editor.shared.copy")}
            isLoading={isBusy}
            onClick={() => void copyShared()}
          />
        </>
      )}
      {draft.isRestored && (
        <Banner
          text={t("editor.draft.restored")}
          actionText={t("editor.draft.discard")}
          onAction={draft.discard}
        />
      )}

      <DisabledScope isDisabled={isReadOnly}>
        <Stack gap={3}>
          <Card>
            <PhotoField
              value={form.imgUrl}
              onChange={(imgUrl) => {
                set({ imgUrl });
              }}
            />
            <Input
              label={`${t("foodEditor.name")} *`}
              value={form.name}
              onValueChange={(name) => {
                set({ name });
              }}
              fieldSize="lg"
            />
            <Input
              label={t("foodEditor.brand")}
              value={form.brand}
              onValueChange={(brand) => {
                set({ brand });
              }}
              fieldSize="lg"
            />
            <Row gap={2} align="end">
              <div className="min-w-0 flex-1">
                <DecimalField
                  label={t("foodEditor.portion")}
                  value={form.portion}
                  onChange={setPortion}
                />
              </div>
              <UnitPicker
                value={form.unit}
                onChange={(unit) => {
                  set({ unit });
                }}
                extraUnits={altUnitsFromRows(form.altUnits)}
              />
              <Button
                size="lg"
                aria-label={t("foodEditor.link.label")}
                aria-pressed={isLinked}
                isActive={isLinked}
                onClick={toggleLink}
              >
                {isLinked ? (
                  <Link2 aria-hidden size={18} />
                ) : (
                  <Link2Off aria-hidden size={18} />
                )}
              </Button>
            </Row>
            {isLinked && (
              <Text variant="caption">{t("foodEditor.link.on")}</Text>
            )}
          </Card>

          {shouldShowMetadata && (
            <Card title={t("foodEditor.metadata.title")}>
              <Row gap={2} shouldWrap align="center">
                <Text variant="label">{t("foodEditor.metadata.basis")}</Text>
                {(["g", "ml"] as const).map((basis) => (
                  <Button
                    key={basis}
                    size="sm"
                    variant={
                      form.nutritionBasis === basis ? "secondary" : "ghost"
                    }
                    aria-pressed={form.nutritionBasis === basis}
                    text={t(
                      basis === "g"
                        ? "foodEditor.metadata.per100g"
                        : "foodEditor.metadata.per100ml",
                    )}
                    onClick={() => {
                      change((current) => toggleNutritionBasis(current, basis));
                    }}
                  />
                ))}
              </Row>
              <Text variant="label">
                {t("foodEditor.metadata.servingUnits")}
              </Text>
              {form.altUnits.map((row, index) => (
                <Row gap={2} align="end" key={index}>
                  <div className="min-w-0 flex-1">
                    <Input
                      label={t("foodEditor.metadata.abbr")}
                      value={row.abbr}
                      onValueChange={(abbr) => {
                        change((current) =>
                          updateAltUnitRow(current, index, { abbr }),
                        );
                      }}
                      fieldSize="lg"
                    />
                  </div>
                  <div className="w-28">
                    <DecimalField
                      label={t("foodEditor.metadata.grams")}
                      value={row.grams}
                      onChange={(grams) => {
                        change((current) =>
                          updateAltUnitRow(current, index, { grams }),
                        );
                      }}
                    />
                  </div>
                  <Button
                    size="md"
                    aria-label={t("foodEditor.metadata.removeUnit")}
                    onClick={() => {
                      change((current) => removeAltUnitRow(current, index));
                    }}
                  >
                    <X aria-hidden size={16} />
                  </Button>
                </Row>
              ))}
              <Button
                size="sm"
                text={t("foodEditor.metadata.addUnit")}
                onClick={() => {
                  change(addAltUnitRow);
                }}
              >
                <Plus aria-hidden size={14} />
              </Button>
              <DecimalField
                label={t("foodEditor.metadata.density")}
                value={form.density}
                onChange={(density) => {
                  set({ density });
                }}
              />
            </Card>
          )}

          <Card>
            <Row gap={2} align="end">
              <div className="min-w-0 flex-1">
                <Input
                  label={t("foodEditor.barcode")}
                  inputMode="numeric"
                  value={form.barcode}
                  onValueChange={(barcode) => {
                    set({ barcode });
                  }}
                  fieldSize="lg"
                />
              </div>
              <Button
                size="lg"
                variant="secondary"
                aria-label={t("foodEditor.scan")}
                onClick={() => {
                  setIsScanning(true);
                }}
              >
                <ScanBarcode aria-hidden size={18} />
              </Button>
            </Row>
            {duplicate && (
              <Banner
                text={t("foodEditor.duplicate", { name: duplicate.name })}
                actionText={t("foodEditor.openExisting")}
                onAction={() =>
                  void navigate(`/nutrition/foods/edit/${duplicate.id}`)
                }
              />
            )}
            <OffActions
              form={form}
              onChange={changeNutrients}
              onNotice={setNotice}
            />
            {notice && (
              <OffNoticeBanner
                notice={notice}
                onUsePrepared={(info) => {
                  const result = applyOffPrepared(
                    form,
                    info,
                    t("foodEditor.off.preparedNote"),
                  );
                  changeNutrients(() => result.form);
                  setNotice(null);
                  notify.success(
                    result.changed > 0
                      ? t("foodEditor.off.updated", { count: result.changed })
                      : t("foodEditor.off.upToDate"),
                  );
                }}
              />
            )}
          </Card>

          <Card title={t("foodEditor.nutrition")}>
            {!isReadOnly && (
              <ScanLabelButton
                onRead={(label) => {
                  changeNutrients((current) => applyLabel(current, label));
                }}
              />
            )}
            <NutrientInputs form={form} onChange={changeNutrients} />
          </Card>

          {settings.foodsShowCategories &&
            settings.foodCategories.length > 0 && (
              <Card title={t("editor.categories")}>
                <Row gap={1} shouldWrap>
                  {settings.foodCategories.map((category) => {
                    const name = categoryName(category);
                    const isOn = form.categories[0] === name;
                    return (
                      <Button
                        key={name}
                        size="sm"
                        variant={isOn ? "secondary" : "ghost"}
                        aria-pressed={isOn}
                        text={categoryDisplay(
                          category,
                          settings.foodsShowLabels,
                        )}
                        // A food has one category
                        onClick={() => {
                          set({ categories: isOn ? [] : [name] });
                        }}
                      />
                    );
                  })}
                </Row>
              </Card>
            )}

          {settings.foodsShowNotes && (
            <Card title={t("editor.notes")}>
              <Input
                multiline
                rows={3}
                aria-label={t("editor.notes")}
                value={form.notes}
                onValueChange={(notes) => {
                  set({ notes });
                }}
              />
            </Card>
          )}
        </Stack>
      </DisabledScope>
      {isScanning && (
        <ScannerDialog
          onCode={(code) => void scanned(code)}
          onClose={() => {
            setIsScanning(false);
          }}
        />
      )}
    </Stack>
  );
}
