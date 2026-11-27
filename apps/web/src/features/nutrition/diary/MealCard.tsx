import {
  Box,
  Button,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Plus,
  X,
  Zap,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryItem } from "../api";
import { FoodThumb } from "../components/FoodThumb";
import { MacroBar } from "../components/Macros";
import { RowMenu } from "../components/RowMenu";
import { isSplit, mealShare } from "../lib/diary";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { ItemRow } from "./ItemRow";
import { itemKcal, itemMeta, itemName, totalAmount } from "./itemText";
import { MealIcon } from "@/features/shared/mealIcon";
import { QuickRows } from "./QuickRows";

/** Drag payloads of the diary (wide screens only) */
export const DRAG_ITEM = "application/x-nt-diary-item";
export const DRAG_MEAL = "application/x-nt-meal-idx";

/** Cycled by meal slot, from monolithium's tokens */
const MEAL_COLORS = [
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-outgoing)",
  "var(--color-incoming)",
  "var(--color-waiting)",
];

export interface MealCardProps {
  index: number;
  name: string;
  items: DiaryItem[];
  isCompleted: boolean;
  isDraggable: boolean;
  /** Which split recipes are unfolded */
  expanded: Set<string>;
  onToggleExpanded: (uuid: string) => void;
  selection: Set<string> | null;
  onToggleSelected: (uuid: string) => void;
  itemActions: (item: DiaryItem) => MenuItem[];
  mealActions: MenuItem[];
  onEdit: (item: DiaryItem) => void;
  onEditChild: (item: DiaryItem, childIndex: number) => void;
  onRemoveChild: (item: DiaryItem, childIndex: number) => void;
  onRemoveQuick: (item: DiaryItem) => void;
  onAdd: () => void;
  onQuickAdd: () => void;
  onToggleCompleted: () => void;
  onShowTotals: () => void;
  onDropItem: (uuid: string) => void;
}

export function MealCard(props: MealCardProps) {
  const { index, name, items, selection } = props;
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const { settings } = useNtSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const title = format.mealName(name);

  const foods = items.filter((item) => item.type !== "quick_calories");
  const quick = items.filter((item) => item.type === "quick_calories");
  const share = settings.diaryShowMacroSummary ? mealShare(items) : null;
  const headerKcal = items.reduce(
    (sum, item) => sum + Math.round(itemKcal(item)),
    0,
  );

  const acceptsDrop = (event: DragEvent) =>
    props.isDraggable && event.dataTransfer.types.includes(DRAG_ITEM);

  return (
    <section
      aria-label={title}
      draggable={props.isDraggable && items.length > 0 && !selection}
      onDragStart={(event) => {
        if (event.target !== event.currentTarget) return;
        event.dataTransfer.setData(DRAG_MEAL, String(index));
        event.dataTransfer.effectAllowed = "copy";
      }}
      onDragOver={(event) => {
        if (!acceptsDrop(event)) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={() => {
        setIsDropTarget(false);
      }}
      onDrop={(event) => {
        if (!acceptsDrop(event)) return;
        event.preventDefault();
        setIsDropTarget(false);
        props.onDropItem(event.dataTransfer.getData(DRAG_ITEM));
      }}
    >
      <Box
        surface="surface"
        border="all"
        radius="lg"
        isClipped
        className={isDropTarget ? "outline-2 outline-accent" : undefined}
      >
        <div
          className="border-l-4 py-2"
          style={{ borderLeftColor: MEAL_COLORS[index % MEAL_COLORS.length] }}
        >
          <Row gap={1} align="center" paddingX={3}>
            <MealIcon name={name} />
            <Box shouldGrow paddingX={2}>
              <Text variant="heading" as="h2" isTruncated>
                {title}
              </Text>
            </Box>
            {settings.diaryShowCompletion && (
              <Button
                size="sm"
                aria-label={t(
                  props.isCompleted ? "diary.reopenMeal" : "diary.completeMeal",
                  { meal: title },
                )}
                aria-pressed={props.isCompleted}
                onClick={props.onToggleCompleted}
              >
                {props.isCompleted ? (
                  <CheckCircle2 aria-hidden size={18} />
                ) : (
                  <Circle aria-hidden size={18} />
                )}
              </Button>
            )}
            {items.length > 0 && !settings.diaryShowMacroSummary && (
              <Text variant="small" tone="muted">
                {format.energy(headerKcal)}
              </Text>
            )}
            <RowMenu
              items={props.mealActions}
              label={t("diary.mealActions", { meal: title })}
              isOpen={isMenuOpen}
              onOpenChange={setIsMenuOpen}
            />
            {settings.showQuickCalories && (
              <Button
                size="sm"
                aria-label={t("diary.quickCaloriesTo", { meal: title })}
                onClick={props.onQuickAdd}
              >
                <Zap aria-hidden size={18} />
              </Button>
            )}
            <Button
              size="sm"
              aria-label={t("diary.addFoodTo", { meal: title })}
              onClick={props.onAdd}
            >
              <Plus aria-hidden size={18} />
            </Button>
          </Row>

          <Stack gap={0}>
            {foods.map((item) => {
              const isOpen = props.expanded.has(item.uuid);
              return (
                <Stack gap={0} key={item.uuid}>
                  <ItemRow
                    name={itemName(item, t)}
                    meta={itemMeta(item, settings, format, t)}
                    thumb={
                      settings.diaryShowThumbnails ? (
                        <FoodThumb url={item.imgUrl} />
                      ) : undefined
                    }
                    onPress={() => {
                      props.onEdit(item);
                    }}
                    actions={props.itemActions(item)}
                    selection={
                      selection
                        ? {
                            isSelected: selection.has(item.uuid),
                            onToggle: () => {
                              props.onToggleSelected(item.uuid);
                            },
                          }
                        : null
                    }
                    onDragStart={
                      props.isDraggable
                        ? (event) => {
                            event.stopPropagation();
                            event.dataTransfer.setData(DRAG_ITEM, item.uuid);
                            event.dataTransfer.effectAllowed = "move";
                          }
                        : undefined
                    }
                    trailing={
                      isSplit(item) ? (
                        <Button
                          size="sm"
                          aria-expanded={isOpen}
                          aria-label={t(
                            isOpen
                              ? "diary.hideIngredients"
                              : "diary.showIngredients",
                          )}
                          onClick={() => {
                            props.onToggleExpanded(item.uuid);
                          }}
                        >
                          {isOpen ? (
                            <ChevronUp aria-hidden size={16} />
                          ) : (
                            <ChevronDown aria-hidden size={16} />
                          )}
                        </Button>
                      ) : undefined
                    }
                  />
                  {isOpen &&
                    item._splitItems?.map((child, childIndex) => (
                      <div key={child.uuid || childIndex} className="pl-8">
                        <ItemRow
                          name={child.name}
                          meta={`${totalAmount(child)} · ${format.energy(itemKcal(child))}`}
                          onPress={() => {
                            props.onEditChild(item, childIndex);
                          }}
                          trailing={
                            <Button
                              size="sm"
                              aria-label={t("diary.removeIngredient", {
                                name: child.name,
                              })}
                              onClick={() => {
                                props.onRemoveChild(item, childIndex);
                              }}
                            >
                              <X aria-hidden size={16} />
                            </Button>
                          }
                        />
                      </div>
                    ))}
                </Stack>
              );
            })}
            <QuickRows
              items={quick}
              onEdit={props.onEdit}
              onRemove={props.onRemoveQuick}
              actionsFor={props.itemActions}
              selection={selection}
              onToggleSelected={props.onToggleSelected}
            />
          </Stack>

          <Pressable
            onPress={props.onAdd}
            paddingX={3}
            paddingY={2}
            fill="width"
          >
            <Text variant="small" tone="muted">
              {t(items.length === 0 ? "diary.tapToAdd" : "diary.addFood")}
            </Text>
          </Pressable>

          {share && (
            <Pressable
              onPress={props.onShowTotals}
              label={t("diary.showMealTotals", { meal: title })}
              paddingX={3}
              gap={1}
              fill="width"
            >
              <MacroBar
                grams={{
                  protein: (share.protein * share.kcal) / 400,
                  carbs: (share.carbs * share.kcal) / 400,
                  fat: (share.fat * share.kcal) / 900,
                }}
              />
              <Text variant="caption">
                {t("diary.mealSplit", {
                  protein: share.protein,
                  carbs: share.carbs,
                  fat: share.fat,
                  energy: format.energy(share.kcal),
                })}
              </Text>
            </Pressable>
          )}
        </div>
      </Box>
    </section>
  );
}
