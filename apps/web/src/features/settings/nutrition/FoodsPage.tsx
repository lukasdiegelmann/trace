import {
  Button,
  Chip,
  EmptyState,
  Row,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useShared } from "../common/binding";
import { TextRow } from "../common/fields";
import { BoundSelect, BoundSwitch } from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import {
  addCustomUnit,
  customUnitList,
  type CustomUnit,
} from "../lib/customUnits";
import {
  addCategory,
  categoryDisplay,
  categoryList,
  categoryName,
  type FoodCategory,
} from "../lib/foodCategories";

const SORTS = ["recent", "most", "alpha"] as const;

function Categories() {
  const { t } = useTranslation("settings");
  const [stored, setStored] = useShared<FoodCategory[]>([
    "nt",
    "foodCategories",
  ]);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const categories = categoryList(stored);
  const add = () => {
    if (!name.trim()) return;
    setStored(addCategory(categories, name, emoji));
    setName("");
    setEmoji("");
  };

  return (
    <Section title={t("foods.categories")}>
      {categories.length === 0 ? (
        <EmptyState text={t("foods.noCategories")} />
      ) : (
        <Row gap={2} shouldWrap>
          {categories.map((category) => (
            <Chip
              key={categoryName(category)}
              text={categoryDisplay(category)}
              actions={[
                {
                  label: t("actions.removeNamed", {
                    name: categoryName(category),
                  }),
                  icon: <X aria-hidden />,
                  onClick: () => {
                    setStored(categories.filter((other) => other !== category));
                  },
                },
              ]}
            />
          ))}
        </Row>
      )}
      {/* TODO(monolithium): an emoji picker; the system's one types into this field. */}
      <TextRow
        label={t("foods.categoryEmoji")}
        hint={t("foods.categoryEmojiHint")}
        value={emoji}
        onCommit={setEmoji}
      />
      <TextRow
        label={t("foods.categoryName")}
        value={name}
        isLive
        onCommit={setName}
        onSubmit={add}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("foods.addCategory")}
          isDisabled={!name.trim()}
          onClick={add}
        />
      </Row>
    </Section>
  );
}

function Units() {
  const { t } = useTranslation("settings");
  const [stored, setStored] = useShared<CustomUnit[]>(["nt", "customUnits"]);
  const [abbr, setAbbr] = useState("");
  const [full, setFull] = useState("");
  const units = customUnitList(stored);
  const add = () => {
    if (!abbr.trim()) return;
    setStored(addCustomUnit(units, abbr, full));
    setAbbr("");
    setFull("");
  };

  return (
    <Section title={t("foods.customUnits")} hint={t("foods.customUnitsHint")}>
      {units.length === 0 ? (
        <EmptyState text={t("foods.noUnits")} />
      ) : (
        <Row gap={2} shouldWrap>
          {units.map((unit) => (
            <Chip
              key={unit.abbr}
              text={
                unit.full === unit.abbr
                  ? unit.abbr
                  : `${unit.abbr} (${unit.full})`
              }
              actions={[
                {
                  label: t("actions.removeNamed", { name: unit.abbr }),
                  icon: <X aria-hidden />,
                  onClick: () => {
                    setStored(units.filter((other) => other !== unit));
                  },
                },
              ]}
            />
          ))}
        </Row>
      )}
      <TextRow
        label={t("foods.unitAbbr")}
        value={abbr}
        isLive
        onCommit={setAbbr}
        onSubmit={add}
      />
      <TextRow
        label={t("foods.unitFull")}
        hint={t("optional")}
        value={full}
        isLive
        onCommit={setFull}
        onSubmit={add}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("foods.addUnit")}
          isDisabled={!abbr.trim()}
          onClick={add}
        />
      </Row>
    </Section>
  );
}

export function FoodsPage() {
  const { t } = useTranslation("settings");
  const sorts = SORTS.map((value) => ({
    value,
    label: t(`foods.sorts.${value}`),
  }));
  return (
    <SettingsScreen
      title={t("topics.foods.title")}
      description={t("topics.foods.description")}
      backends={["nt", "ct"]}
    >
      <Section title={t("foods.display")}>
        {(
          [
            "foodsShowThumbnails",
            "foodsShowCategories",
            "foodsShowLabels",
            "foodsShowNotes",
            "foodsShowYesterdayMeals",
          ] as const
        ).map((key) => (
          <BoundSwitch
            key={key}
            refs={[["nt", key]]}
            label={t(`foods.toggles.${key}`)}
          />
        ))}
      </Section>
      <Section title={t("foods.sorting")} hint={t("foods.sortingHint")}>
        {(["foodsSort", "mealsSort", "recipesSort"] as const).map((key) => (
          <BoundSelect<string>
            key={key}
            refs={[["nt", key]]}
            label={t(`foods.sortOf.${key}`)}
            options={sorts}
          />
        ))}
      </Section>
      <Section title={t("foods.scanning")}>
        <BoundSwitch
          refs={[["nt", "barcodeBeep"]]}
          label={t("foods.beepNutrition")}
        />
        <BoundSwitch
          refs={[["ct", "barcodeBeep"]]}
          label={t("foods.beepCooking")}
        />
        <BoundSwitch
          refs={[
            ["ct", "barcodeFlashlight"],
            ["nt", "barcodeFlashlight"],
          ]}
          label={t("foods.flashlight")}
        />
        <BoundSwitch
          refs={[["nt", "cropPhotos"]]}
          label={t("foods.cropPhotos")}
        />
      </Section>
      <Categories />
      <Units />
    </SettingsScreen>
  );
}
