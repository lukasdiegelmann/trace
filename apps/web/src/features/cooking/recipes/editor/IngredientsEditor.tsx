import {
  Button,
  Input,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { Link2, Plus, Refrigerator, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { RowMenu } from "../../common/RowMenu";
import { UnitPicker } from "../../common/UnitPicker";
import { normaliseQtyForUnit } from "../../lib/qty";
import {
  addFromPantry,
  blankIngredient,
  moveIngredient,
  removeIngredient,
  removeSection,
  splitSection,
  unlinkIngredient,
  updateIngredient,
  type DraftGroup,
  type DraftIngredient,
  type RowAt,
} from "../../lib/recipeEditor";
import type { PantryRow } from "../../recipesApi";

import { PantryPickerDialog } from "./PantryPickerDialog";

export interface IngredientsEditorProps {
  groups: DraftGroup[];
  onChange: (groups: DraftGroup[]) => void;
  pantry: PantryRow[];
}

/** The ingredients in sections; each row can link to a pantry item */
export function IngredientsEditor({
  groups,
  onChange,
  pantry,
}: IngredientsEditorProps) {
  const { t } = useTranslation("cooking");
  const suggestions = useId();
  /** "add" appends rows; a position links that row */
  const [picking, setPicking] = useState<"add" | RowAt | null>(null);

  const patch = (at: RowAt, values: Partial<DraftIngredient>) => {
    onChange(updateIngredient(groups, at, values));
  };
  const pantryName = (id: number) =>
    pantry.find((row) => row.id === id)?.name ?? t("recipeEditor.pantry.item");

  const menuFor = (item: DraftIngredient, at: RowAt): MenuItem[] => {
    const isFirst = at.group === 0 && at.item === 0;
    const isLast =
      at.group === groups.length - 1 &&
      at.item === groups[at.group].items.length - 1;
    return [
      {
        id: "pantry",
        text:
          item.pantry_item_id === undefined
            ? t("recipeEditor.rows.link")
            : t("recipeEditor.rows.unlink"),
        onSelect: () => {
          if (item.pantry_item_id === undefined) setPicking(at);
          else onChange(unlinkIngredient(groups, at));
        },
      },
      {
        id: "section",
        text: t("recipeEditor.rows.startSection"),
        onSelect: () => {
          onChange(splitSection(groups, at, t("recipeEditor.rows.newSection")));
        },
      },
      {
        id: "up",
        text: t("recipeEditor.rows.moveUp"),
        isDisabled: isFirst,
        onSelect: () => {
          onChange(moveIngredient(groups, at, -1));
        },
      },
      {
        id: "down",
        text: t("recipeEditor.rows.moveDown"),
        isDisabled: isLast,
        onSelect: () => {
          onChange(moveIngredient(groups, at, 1));
        },
      },
      {
        id: "delete",
        text: t("cookingCommon.delete"),
        tone: "danger",
        hasSeparatorBefore: true,
        onSelect: () => {
          onChange(removeIngredient(groups, at));
        },
      },
    ];
  };

  return (
    <Stack gap={3} as="section">
      <Text variant="heading" as="h2">
        {t("recipeView.ingredients")}
      </Text>
      {/* The pantry's names as the browser's own suggestions.
          TODO(monolithium): a free-text input with suggestions (combobox) */}
      <datalist id={suggestions}>
        {[...new Set(pantry.map((row) => row.name))]
          .sort((a, b) => a.localeCompare(b))
          .map((name) => (
            <option key={name} value={name} />
          ))}
      </datalist>
      {groups.map((group, groupIndex) => (
        <Stack gap={2} key={group.key}>
          {groups.length > 1 || group.name ? (
            <Row gap={2} align="center">
              <div className="min-w-0 flex-1">
                <Input
                  aria-label={t("recipeEditor.rows.sectionName")}
                  placeholder={t("recipeEditor.rows.sectionPlaceholder")}
                  value={group.name}
                  onValueChange={(name) => {
                    onChange(
                      groups.map((g, i) =>
                        i === groupIndex ? { ...g, name } : g,
                      ),
                    );
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("recipeEditor.rows.removeSection")}
                onClick={() => {
                  onChange(removeSection(groups, groupIndex));
                }}
              >
                <Trash2 aria-hidden size={16} />
              </Button>
            </Row>
          ) : null}
          {group.items.map((item, itemIndex) => {
            const at = { group: groupIndex, item: itemIndex };
            const label = item.name || t("recipeEditor.rows.ingredient");
            return (
              <div
                key={item.id}
                role="group"
                aria-label={label}
                className="flex flex-col gap-2 border-b border-border-subtle pb-2"
              >
                <div className="flex items-end gap-2">
                  <div className="w-20 shrink-0">
                    <Input
                      aria-label={t("recipeEditor.rows.qty")}
                      placeholder="1"
                      value={item.qty}
                      onValueChange={(qty) => {
                        patch(at, { qty });
                      }}
                      onBlur={() => {
                        const qty = normaliseQtyForUnit(item.qty, item.unit);
                        if (qty !== item.qty) patch(at, { qty });
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <UnitPicker
                      label={t("recipeEditor.rows.unit")}
                      value={item.unit}
                      onChange={(unit) => {
                        patch(at, { unit });
                      }}
                    />
                  </div>
                  <RowMenu
                    label={t("cookingCommon.actionsFor", { name: label })}
                    items={menuFor(item, at)}
                  />
                </div>
                <div className="flex gap-2 compact:flex-col">
                  <div className="min-w-0 flex-[3]">
                    <Input
                      aria-label={t("recipeEditor.rows.name")}
                      placeholder={t("recipeEditor.rows.namePlaceholder")}
                      list={suggestions}
                      value={item.name}
                      icon={
                        item.pantry_item_id === undefined ? undefined : (
                          <span
                            role="img"
                            aria-label={t("recipeEditor.rows.linkedTo", {
                              name: pantryName(item.pantry_item_id),
                            })}
                            title={t("recipeEditor.rows.linkedTo", {
                              name: pantryName(item.pantry_item_id),
                            })}
                            className="text-accent"
                          >
                            <Link2 aria-hidden size={14} />
                          </span>
                        )
                      }
                      onValueChange={(name) => {
                        patch(at, { name });
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-[2]">
                    <Input
                      aria-label={t("recipeEditor.rows.note")}
                      placeholder={t("recipeEditor.rows.notePlaceholder")}
                      value={item.note}
                      onValueChange={(note) => {
                        patch(at, { note });
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </Stack>
      ))}
      <Row gap={2} shouldWrap>
        <Button
          variant="secondary"
          size="sm"
          text={t("recipeEditor.rows.add")}
          onClick={() => {
            onChange(
              groups.map((group, i) =>
                i === groups.length - 1
                  ? { ...group, items: [...group.items, blankIngredient()] }
                  : group,
              ),
            );
          }}
        >
          <Plus aria-hidden size={14} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          text={t("recipeEditor.pantry.addTitle")}
          onClick={() => {
            setPicking("add");
          }}
        >
          <Refrigerator aria-hidden size={14} />
        </Button>
      </Row>
      {picking ? (
        <PantryPickerDialog
          rows={pantry}
          isSingle={picking !== "add"}
          onClose={() => {
            setPicking(null);
          }}
          onPick={(rows) => {
            if (picking === "add") {
              onChange(addFromPantry(groups, rows));
            } else {
              const [row] = rows;
              const current = groups[picking.group].items[picking.item];
              patch(picking, {
                pantry_item_id: row.id,
                name: current.name || row.name,
                unit: current.unit || (row.serving_unit ?? ""),
              });
            }
            setPicking(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
