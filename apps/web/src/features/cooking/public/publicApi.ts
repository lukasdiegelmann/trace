/** `GET /ct/api/r/:token` (server/routes/share.js), without a session */
import { apiPath } from "@/api";

import type { Nutrition } from "../lib/nutriments";
import type { IngredientGroup, RecipeStep } from "../recipesApi";

export interface PublicRecipe {
  name: string;
  description: string | null;
  img_url: string | null;
  servings: number | null;
  yield_text: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: IngredientGroup[];
  steps: (string | RecipeStep)[];
  tools: string[];
  nutrition: Nutrition;
  source_url: string | null;
  notes: string | null;
  created_by_username: string | null;
  created_by_full_name: string | null;
  created_at: string | null;
  category: { name: string; color: string | null } | null;
}

/** The link is unknown, revoked or its recipe deleted */
export class LinkGoneError extends Error {}

export async function getPublicRecipe(
  token: string,
  doFetch: typeof fetch = fetch,
): Promise<PublicRecipe> {
  // No cookies: the page shows the same to everyone.
  const response = await doFetch(
    apiPath("ct", `/r/${encodeURIComponent(token)}`),
    { credentials: "omit", cache: "no-store" },
  );
  if (response.status === 404 || response.status === 400) {
    throw new LinkGoneError();
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as PublicRecipe;
}
