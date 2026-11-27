/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON shapes */
/** The importer calls (server/routes/recipes.js) */
import { api } from "@/api";

export interface ImportOptions {
  addToPantry: boolean;
  applyTags: boolean;
  importCategories: boolean;
}

/** The old dialogs' defaults */
export const DEFAULT_OPTIONS: ImportOptions = {
  addToPantry: false,
  applyTags: false,
  importCategories: true,
};

function withOptions(form: FormData, options: ImportOptions): FormData {
  for (const [key, value] of Object.entries(options)) {
    form.append(key, String(value));
  }
  return form;
}

/** Pasted JSON or HTML, or a file of it (Paprika archives included) */
export function importRecipe(
  source: { text: string } | { file: File },
  options: ImportOptions,
) {
  if ("text" in source) {
    return api.ct.post<unknown>("/recipes/import", { ...source, ...options });
  }
  const form = new FormData();
  form.append("file", source.file);
  return api.ct.post<unknown>("/recipes/import", withOptions(form, options));
}

export const scrapeRecipe = (url: string, options: ImportOptions) =>
  api.ct.post<unknown>("/recipes/scrape", { url, ...options });

/** One row of a batch the server keeps until it is saved or dropped */
export interface BatchItem {
  id: string;
  filename: string;
  source: string | null;
  url?: string;
  tier?: string;
  error?: string;
  empty: boolean;
  hint?: string;
  confidence: number;
  name?: string;
  ingredientCount?: number;
  stepCount?: number;
}

export interface Batch {
  cacheUuid: string;
  highConfidenceThreshold: number;
  items: BatchItem[];
}

export const scrapeBatch = (urls: string[]) =>
  api.ct.post<Batch>("/recipes/batch-scrape", { urls });

export function scanFiles(files: File[]) {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file, file.webkitRelativePath || file.name);
  }
  return api.ct.post<Batch>("/recipes/bulk-scan", form);
}

export interface CommitResult {
  count: number;
  failed: { id: string; reason: string }[];
}

export const commitBatch = (
  cacheUuid: string,
  selectedIds: string[],
  options: ImportOptions,
) =>
  api.ct.post<CommitResult>("/recipes/bulk-commit", {
    cacheUuid,
    selectedIds,
    ...options,
  });

/** Best effort: the server drops unsaved batches on its own later */
export const cancelBatch = (cacheUuid: string) =>
  api.ct.post("/recipes/bulk-cancel", { cacheUuid }).catch(() => {});

export const getBatchText = (cacheUuid: string, id: string) =>
  api.ct.get<{ text: string }>(
    `/recipes/bulk-text/${encodeURIComponent(cacheUuid)}/${encodeURIComponent(id)}`,
  );

export interface Extraction {
  type: string;
  text: string;
  empty: boolean;
  pages?: number;
  hint?: string;
  confidence: number;
  highConfidenceThreshold?: number;
  recipe: {
    name?: string;
    servings?: number | null;
    prep_minutes?: number | null;
    cook_minutes?: number | null;
    rest_minutes?: number | null;
    ingredients?: { items?: unknown[] }[];
    steps?: unknown[];
  } | null;
}

/** The text of a PDF, RTF, TXT or MD file and what a parser reads in it */
export function extractFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.ct.post<Extraction>("/recipes/extract-and-parse", form);
}

/** Parses again and saves the result */
export function saveExtraction(file: File, options: ImportOptions) {
  const form = new FormData();
  form.append("file", file);
  form.append("save", "true");
  return api.ct.post<{ recipe: { id: number; name: string } | null }>(
    "/recipes/extract-and-parse",
    withOptions(form, options),
  );
}

export interface EnvLocks {
  /** AI is set up through the server's environment */
  ai?: boolean;
}

export const getEnvLocks = () => api.ct.get<EnvLocks>("/app-config/env-locks");
