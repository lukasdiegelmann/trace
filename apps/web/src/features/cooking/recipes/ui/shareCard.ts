import type { TFunction } from "i18next";

import { assetUrl } from "../../lib/assetUrl";
import {
  buildRecipeCardPages,
  cardFilename,
  type CardTexts,
} from "../../lib/recipeCard";
import type { Recipe } from "../../recipesApi";
import {
  shareBlobs,
  svgToPngBlob,
  type ShareResult,
} from "../../lib/shoppingCard";

function cardTexts(t: TFunction<"cooking">): CardTexts {
  return {
    untitled: t("recipeCommon.card.untitled"),
    ingredients: t("recipeCommon.card.ingredients"),
    steps: t("recipeCommon.card.steps"),
    continued: t("recipeCommon.card.continued"),
    serves: (count) => t("recipeCommon.card.serves", { count }),
    page: (page, total) => t("recipeCommon.card.page", { page, total }),
    more: (count) => t("recipeCommon.card.more", { count }),
  };
}

/** The hero as a data URL, so rasterising doesn't taint the canvas */
async function heroDataUrl(url: string | null): Promise<string | null> {
  const source = assetUrl(url);
  if (!source) return null;
  try {
    const response = await fetch(source, { credentials: "same-origin" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Renders the recipe's card pages and shares (or downloads) them */
export async function shareRecipeCard(
  recipe: Recipe,
  t: TFunction<"cooking">,
): Promise<ShareResult> {
  const pages = buildRecipeCardPages(
    recipe,
    cardTexts(t),
    await heroDataUrl(recipe.img_url),
  );
  const parts = [];
  for (const page of pages) {
    parts.push({
      blob: await svgToPngBlob(page.svg, page.width, page.height),
      filename: cardFilename(recipe.name, page.page, page.total),
    });
  }
  return shareBlobs(parts, recipe.name);
}
