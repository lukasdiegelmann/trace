import {
  Input,
  Pressable,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Check, Utensils } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../lib/assetUrl";
import { foldText } from "../lib/searchText";
import { compareByName } from "../lib/pantryList";
import { manageApi, type RecipeSummary } from "../manageApi";
import { ErrorState, LoadingState } from "./states";
import { useLoad } from "./useLoad";

/** The user's recipes by name, with a search */
export function RecipePicker({
  selectedId,
  onPick,
  isDisabled = false,
  hasPantryMatch = false,
}: {
  selectedId?: number | null;
  onPick: (recipe: RecipeSummary) => void;
  isDisabled?: boolean;
  /** Shows "n/m in pantry" */
  hasPantryMatch?: boolean;
}) {
  const { t } = useTranslation("cooking");
  const [query, setQuery] = useState("");
  const load = useCallback(
    async () => [...(await manageApi.recipes())].sort(compareByName),
    [],
  );
  const { data, error, reload } = useLoad(load);

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload()} />;
  }
  if (!data) return <LoadingState />;
  const needle = foldText(query).trim();
  const recipes = data.filter((recipe) =>
    foldText(recipe.name).includes(needle),
  );

  return (
    <Stack gap={2}>
      <Input
        type="search"
        label={t("cookingCommon.recipes.search")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <Stack gap={1} className="max-h-72 overflow-y-auto">
        {recipes.length === 0 ? (
          <Text tone="muted">{t("cookingCommon.recipes.none")}</Text>
        ) : null}
        {recipes.map((recipe) => (
          <Pressable
            key={recipe.id}
            isDisabled={isDisabled}
            isPressed={selectedId === recipe.id}
            onPress={() => {
              onPick(recipe);
            }}
            className="flex w-full shrink-0 flex-row items-center gap-3 rounded-control p-2 text-start hover:bg-level-3! aria-pressed:bg-level-3!"
          >
            {recipe.img_url ? (
              <img
                src={assetUrl(recipe.img_url)}
                alt=""
                loading="lazy"
                className="size-10 rounded-control object-cover"
              />
            ) : (
              <span className="flex size-10 items-center justify-center">
                <Utensils aria-hidden size={20} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <Text as="span" isTruncated>
                {recipe.name}
              </Text>
              {hasPantryMatch && recipe.pantry_match ? (
                <Text as="span" variant="caption" tone="muted">
                  {" "}
                  {t("cookingCommon.recipes.inPantry", {
                    have: recipe.pantry_match.have,
                    need: recipe.pantry_match.need,
                  })}
                </Text>
              ) : null}
            </span>
            {selectedId === recipe.id ? <Check aria-hidden size={16} /> : null}
          </Pressable>
        ))}
      </Stack>
    </Stack>
  );
}
