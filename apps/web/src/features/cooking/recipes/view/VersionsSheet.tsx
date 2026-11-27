import {
  Button,
  Chip,
  Row,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { formatDate, formatTime } from "../../lib/dates";
import { displayQty } from "../../lib/qty";
import { versionDiffers } from "../../lib/recipeVersions";
import { stepsOf, type Recipe, type RecipeVersion } from "../../recipesApi";

import { RichText } from "./RichText";

const REASONS = ["conflict", "restore", "replaced"] as const;

const reasonOf = (value: string) =>
  REASONS.find((reason) => reason === value) ?? "conflict";

function Preview({ version }: { version: Partial<Recipe> }) {
  return (
    <Stack gap={2} className="rounded-container bg-level-2 p-3">
      <Text variant="heading" as="h3">
        {version.name}
      </Text>
      {version.description ? (
        <Text shouldKeepLineBreaks>{version.description}</Text>
      ) : null}
      {(version.ingredients ?? []).map((group, index) => (
        <Stack gap={1} key={index}>
          {group.name ? <Text variant="label">{group.name}</Text> : null}
          {group.items.map((item, itemIndex) => (
            <Text variant="small" key={itemIndex}>
              {[displayQty(item.qty, item.unit), item.unit, item.name]
                .filter(Boolean)
                .join(" ")}
            </Text>
          ))}
        </Stack>
      ))}
      <ol className="list-decimal pl-5">
        {stepsOf({ steps: version.steps ?? [] }).map((step, index) => (
          <li key={index} className="text-body whitespace-pre-line">
            {[step.title, step.text].filter(Boolean).join("\n")}
          </li>
        ))}
      </ol>
      {version.notes ? <RichText html={version.notes} /> : null}
    </Stack>
  );
}

export interface VersionsSheetProps {
  recipe: Recipe;
  versions: RecipeVersion[];
  userId: number | null;
  isRestoring: boolean;
  onRestore: (version: RecipeVersion) => void;
  onClose: () => void;
}

/** The recipe as it was before a save replaced it */
export function VersionsSheet({
  recipe,
  versions,
  userId,
  isRestoring,
  onRestore,
  onClose,
}: VersionsSheetProps) {
  const { t, i18n } = useTranslation("cooking");
  const [dateFormat] = useSetting("ct", "dateFormat");
  const [timeFormat] = useSetting("ct", "timeFormat");
  const [previewId, setPreviewId] = useState<number | null>(null);

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("recipeView.versions.title")}
      description={t("recipeView.versions.intro")}
    >
      <Stack gap={3}>
        {versions.map((version) => {
          const reason = reasonOf(version.reason);
          const isByOther =
            version.edited_by !== null &&
            version.edited_by !== userId &&
            Boolean(version.edited_by_name);
          const differs = versionDiffers(version.data, recipe);
          const isPreviewed = previewId === version.id;
          return (
            <Stack
              gap={2}
              key={version.id}
              className="rounded-container border border-border p-3"
            >
              <Text variant="small">
                {formatDate(version.created_at, dateFormat, i18n.language)},{" "}
                {formatTime(version.created_at, timeFormat, i18n.language)}
              </Text>
              <Text variant="caption" tone="muted">
                {isByOther
                  ? t(`recipeView.versions.reasonBy.${reason}`, {
                      name: version.edited_by_name ?? "",
                    })
                  : t(`recipeView.versions.reason.${reason}`)}
              </Text>
              <Text>{version.data.name}</Text>
              {differs.length > 0 ? (
                <Row gap={1} shouldWrap align="center">
                  <Text variant="caption" tone="muted">
                    {t("recipeView.versions.differs")}
                  </Text>
                  {differs.map((part) => (
                    <Chip
                      key={part}
                      text={t(`recipeView.versions.parts.${part}`)}
                    />
                  ))}
                </Row>
              ) : null}
              <Row gap={2}>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-expanded={isPreviewed}
                  text={
                    isPreviewed
                      ? t("recipeView.versions.hidePreview")
                      : t("recipeView.versions.preview")
                  }
                  onClick={() => {
                    setPreviewId(isPreviewed ? null : version.id);
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  text={t("recipeView.versions.restore")}
                  isDisabled={isRestoring}
                  onClick={() => {
                    onRestore(version);
                  }}
                />
              </Row>
              {isPreviewed ? <Preview version={version.data} /> : null}
            </Stack>
          );
        })}
      </Stack>
    </Sheet>
  );
}
