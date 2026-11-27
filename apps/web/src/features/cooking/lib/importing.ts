/**
 * The decisions of the importers, ported from
 * cooktrace/src/components/recipe/*Import*Dialog.svelte.
 */
export const MAX_BATCH_URLS = 100;

/** URLs separated by spaces, commas or lines; each once, in order */
export function parseUrlList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];
}

export type FileKind = "image" | "text" | "zip" | "other";

export function fileKind(file: { name: string; type: string }): FileKind {
  if (/\.zip$/i.test(file.name) || /^application\/(x-)?zip/.test(file.type)) {
    return "zip";
  }
  if (file.type.startsWith("image/")) return "image";
  if (/\.(pdf|rtf|txt|md|markdown)$/i.test(file.name)) return "text";
  return "other";
}

export type FileRoute = "single" | "bulk" | "unsupported" | "none";

/** One photo or text file goes alone; a ZIP or several files in bulk */
export function routeFiles(
  files: readonly { name: string; type: string }[],
): FileRoute {
  if (files.length === 0) return "none";
  if (files.length > 1) return "bulk";
  const kind = fileKind(files[0]);
  if (kind === "zip") return "bulk";
  return kind === "other" ? "unsupported" : "single";
}

/** A batch row that was read and can be saved */
export const isSelectable = (item: {
  error?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the backend's JSON
  empty: boolean;
}) => !item.error && !item.empty;

export type Confidence = "clean" | "partial" | "bestEffort";

export function confidenceOf(value: number, threshold: number): Confidence {
  if (value >= threshold) return "clean";
  return value >= 0.4 ? "partial" : "bestEffort";
}

/**
 * An image-only PDF. The backend should say `empty`, but its PDF library
 * adds "-- 1 of 3 --" after every page, so a scan arrives as just those.
 */
export function isScan(extraction: {
  type: string;
  text: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the backend's JSON
  empty: boolean;
}): boolean {
  if (extraction.empty) return true;
  return (
    extraction.type === "pdf" &&
    !extraction.text.replace(/^-- \d+ of \d+ --$/gm, "").trim()
  );
}

/** What `POST /recipes/import` and `/recipes/scrape` can answer */
export type ImportAnswer =
  | { kind: "recipe"; id: number; hasSteps: boolean }
  | { kind: "duplicate"; existingId: number | null }
  | { kind: "archive"; count: number; skipped: number };

interface RawAnswer {
  id?: number;
  steps?: (string | { text?: string })[];

  skipped?: boolean | unknown[];
  existing_id?: number | null;
  recipes?: unknown[];
  count?: number;
}

export function readImportAnswer(value: unknown): ImportAnswer {
  const answer = value as RawAnswer;
  if (Array.isArray(answer.recipes)) {
    return {
      kind: "archive",
      count: answer.count ?? answer.recipes.length,
      skipped: Array.isArray(answer.skipped) ? answer.skipped.length : 0,
    };
  }
  if (answer.skipped === true) {
    return { kind: "duplicate", existingId: answer.existing_id ?? null };
  }
  const hasSteps = (answer.steps ?? []).some((step) =>
    typeof step === "string" ? step.trim() : step.text?.trim(),
  );
  return { kind: "recipe", id: Number(answer.id), hasSteps };
}
