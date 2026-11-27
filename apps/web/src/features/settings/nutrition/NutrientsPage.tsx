import {
  Button,
  EmptyState,
  KeyValue,
  Row,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useShared } from "../common/binding";
import { CheckList, SelectRow, TextRow } from "../common/fields";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { SortableList } from "../common/SortableList";
import { toggleItem } from "../lib/lists";
import { NUTRIMENTS } from "../lib/nutrimentCatalog";
import {
  addCustomNutriment,
  CUSTOM_UNITS_OF_NUTRIENTS,
  customNutrimentList,
  orderedNutrimentIds,
  visibleNutrimentIds,
  type CustomNutriment,
} from "../lib/nutrientSettings";

const CATEGORIES = ["energy", "macro", "mineral", "vitamin", "other"] as const;

function Custom() {
  const { t } = useTranslation("settings");
  const [stored, setStored] = useShared<CustomNutriment[]>([
    "nt",
    "customNutriments",
  ]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("g");
  const custom = customNutrimentList(stored);

  return (
    <Section title={t("nutrients.custom")}>
      {custom.length === 0 ? (
        <EmptyState text={t("nutrients.noCustom")} />
      ) : null}
      {custom.map((item) => (
        <KeyValue
          key={item.id}
          label={`${item.label} (${item.unit})`}
          value={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("actions.removeNamed", { name: item.label })}
              onClick={() => {
                setStored(custom.filter((other) => other.id !== item.id));
              }}
            >
              <X aria-hidden />
            </Button>
          }
        />
      ))}
      <TextRow
        label={t("nutrients.name")}
        value={name}
        isLive
        onCommit={setName}
      />
      <SelectRow<string>
        label={t("nutrients.unit")}
        value={unit}
        options={CUSTOM_UNITS_OF_NUTRIENTS.map((value) => ({
          value,
          label: value,
        }))}
        onChange={setUnit}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("nutrients.addCustom")}
          isDisabled={!name.trim()}
          onClick={() => {
            setStored(addCustomNutriment(custom, name, unit));
            setName("");
          }}
        />
      </Row>
    </Section>
  );
}

export function NutrientsPage() {
  const { t } = useTranslation("settings");
  const [order, setOrder] = useShared<unknown>(["nt", "nutrimentsOrder"]);
  const [ntVisible, setNtVisible] = useShared<unknown>([
    "nt",
    "visibleNutriments",
  ]);
  const [ctVisible, setCtVisible] = useShared<unknown>([
    "ct",
    "visibleNutriments",
  ]);
  const byId = new Map(NUTRIMENTS.map((n) => [n.id as string, n]));
  const diaryIds = visibleNutrimentIds("nt", ntVisible);
  const recipeIds = visibleNutrimentIds("ct", ctVisible);
  const name = (id: string) => {
    const nutriment = byId.get(id);
    return nutriment
      ? `${t(`nutriment.${nutriment.id}`)} (${nutriment.unit})`
      : id;
  };

  return (
    <SettingsScreen
      title={t("topics.nutrients.title")}
      description={t("topics.nutrients.description")}
      backends={["nt", "ct"]}
    >
      <Section title={t("nutrients.diary")} hint={t("nutrients.diaryHint")}>
        <SortableList
          label={t("nutrients.diary")}
          items={orderedNutrimentIds(order).map((id) => ({
            id,
            label: name(id),
            isChecked: diaryIds.includes(id),
          }))}
          onReorder={setOrder}
          onToggle={(id, isOn) => {
            setNtVisible(toggleItem(diaryIds, id, isOn));
          }}
        />
      </Section>
      <Custom />
      <Section title={t("nutrients.recipes")}>
        <Row gap={2} shouldWrap>
          <Button
            variant="secondary"
            size="sm"
            text={t("nutrients.defaults")}
            onClick={() => {
              setCtVisible(null);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            text={t("nutrients.showAll")}
            onClick={() => {
              setCtVisible(NUTRIMENTS.map((n) => n.id));
            }}
          />
        </Row>
        {CATEGORIES.map((category) => {
          const ids: string[] = NUTRIMENTS.filter(
            (n) => n.category === category,
          ).map((n) => n.id);
          return (
            <CheckList<string>
              key={category}
              isInline
              label={t(`nutrients.categories.${category}`)}
              options={ids.map((id) => ({ value: id, label: name(id) }))}
              values={recipeIds.filter((id) => ids.includes(id))}
              onChange={(picked) => {
                setCtVisible([
                  ...recipeIds.filter((id) => !ids.includes(id)),
                  ...picked,
                ]);
              }}
            />
          );
        })}
      </Section>
    </SettingsScreen>
  );
}
