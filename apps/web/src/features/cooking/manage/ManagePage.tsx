import { Pressable, Stack, Text } from "@monocircuit/monolithium/components";
import {
  Blend,
  BookOpen,
  Refrigerator,
  Ruler,
  Tag,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { PageHeader } from "../common/PageHeader";
import {
  asManageSection,
  MANAGE_SECTIONS,
  type ManageSection,
} from "../lib/manage";
import { CookbooksSection } from "./CookbooksSection";
import { PantryCategoriesSection } from "./PantryCategoriesSection";
import { RecipeCategoriesSection } from "./RecipeCategoriesSection";
import { TaxonomySection } from "./TaxonomySection";
import { UnitsSection } from "./UnitsSection";

const ICONS: Record<ManageSection, LucideIcon> = {
  "recipe-categories": Tag,
  tags: Tags,
  "kitchen-gear": Blend,
  "pantry-categories": Refrigerator,
  units: Ruler,
  cookbooks: BookOpen,
};

function Section({ section }: { section: ManageSection }) {
  switch (section) {
    case "recipe-categories":
      return <RecipeCategoriesSection />;
    case "tags":
      return <TaxonomySection key="tags" kind="tags" />;
    case "kitchen-gear":
      return <TaxonomySection key="tools" kind="tools" />;
    case "pantry-categories":
      return <PantryCategoriesSection />;
    case "units":
      return <UnitsSection />;
    case "cookbooks":
      return <CookbooksSection />;
  }
}

/** Every taxonomy of CookTrace; /cooking/manage/:section links into one */
export function ManagePage() {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const { section } = useParams();
  const active = asManageSection(section);
  return (
    <Stack gap={4} padding={4}>
      <PageHeader title={t("manage.title")} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* TODO(monolithium): a section rail with descriptions */}
        <nav
          aria-label={t("manage.sectionsLabel")}
          className="flex gap-2 overflow-x-auto lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-visible"
        >
          {MANAGE_SECTIONS.map((id) => {
            const Icon = ICONS[id];
            return (
              <Pressable
                key={id}
                isPressed={id === active}
                onPress={() =>
                  void navigate(`/cooking/manage/${id}`, { replace: true })
                }
                className="flex shrink-0 flex-row items-center justify-start gap-3 rounded-container border! border-border! px-3 py-2 text-start aria-pressed:border-accent! aria-pressed:bg-level-3!"
              >
                <Icon aria-hidden size={18} />
                <span className="flex min-w-0 flex-col">
                  <Text as="span">{t(`manage.sections.${id}.label`)}</Text>
                  <Text
                    as="span"
                    variant="caption"
                    tone="muted"
                    className="max-lg:hidden"
                  >
                    {t(`manage.sections.${id}.description`)}
                  </Text>
                </span>
              </Pressable>
            );
          })}
        </nav>
        <div className="min-w-0 max-w-3xl flex-1">
          <Section section={active} />
        </div>
      </div>
    </Stack>
  );
}
