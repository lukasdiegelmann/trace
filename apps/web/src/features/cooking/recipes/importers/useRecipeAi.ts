import { useCallback } from "react";

import { useSetting } from "@/features/shared/settings";

import { useLoad } from "../../common/useLoad";
import { askAi, readImage, type AiImage } from "../../lib/aiChat";
import { recipesFromReply, SINGLE_RECIPE_PROMPT } from "../../lib/recipeAi";
import { createRecipe, type Recipe } from "../../recipesApi";

import { getEnvLocks, type EnvLocks } from "./importApi";

/** What an AI answer may take; a cookbook has many recipes */
const MAX_TOKENS = 16_000;
/** The providers' limit for a document */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface ExtractResult {
  saved: Recipe[];
  isCutOff: boolean;
}

export interface RecipeAi {
  isEnabled: boolean;
  /** The server's AI setup: its proxy can't take these long imports */
  isEnvLocked: boolean;
  isAvailable: boolean;
  /** Only Claude and Gemini read PDFs */
  canReadPdf: boolean;
  /** Asks once and saves every recipe of the answer */
  extract: (
    question: { prompt: string; systemPrompt?: string; image?: AiImage },
    onSaved?: (count: number) => void,
  ) => Promise<ExtractResult>;
  readFile: (file: Blob) => Promise<AiImage>;
}

export function useRecipeAi(): RecipeAi {
  const [isEnabled] = useSetting("ct", "aiEnabled");
  const [provider] = useSetting("ct", "aiProvider");
  const [apiKey] = useSetting("ct", "aiApiKey");
  const [model] = useSetting("ct", "aiModel");
  const [baseUrl] = useSetting("ct", "aiBaseUrl");
  const locks = useLoad(
    useCallback(() => getEnvLocks().catch((): EnvLocks => ({})), []),
  );
  const isEnvLocked = Boolean(locks.data?.ai);

  const extract = useCallback<RecipeAi["extract"]>(
    async (question, onSaved) => {
      const reply = await askAi(
        { provider, apiKey, model, baseUrl },
        {
          systemPrompt: SINGLE_RECIPE_PROMPT,
          maxTokens: MAX_TOKENS,
          ...question,
        },
        false,
      );
      const { recipes, isCutOff } = recipesFromReply(reply);
      const saved: Recipe[] = [];
      for (const recipe of recipes) {
        saved.push(await createRecipe(recipe));
        onSaved?.(saved.length);
      }
      return { saved, isCutOff };
    },
    [provider, apiKey, model, baseUrl],
  );

  return {
    isEnabled,
    isEnvLocked,
    isAvailable: isEnabled && !isEnvLocked,
    canReadPdf: provider === "claude" || provider === "gemini",
    extract,
    readFile: readImage,
  };
}
