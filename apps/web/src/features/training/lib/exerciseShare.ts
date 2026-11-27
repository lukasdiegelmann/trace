/**
 * One exercise as a portable JSON file, after
 * backends/lifttrace/src/lib/exerciseShare.js (format version 1). Errors
 * carry a code the UI translates.
 */

const FORMAT = "lifttrace-exercise";
const VERSION = 1;

/** Everything else (ids, owner, source) stays on this instance */
const PORTABLE_FIELDS = [
  "name",
  "category",
  "primary_muscles",
  "secondary_muscles",
  "equipment",
  "instructions",
  "tips",
  "img_url",
  "gif_url",
  "video_url",
  "load_type",
  "set_type",
] as const;

export type PortableExercise = Record<string, unknown> & { name: string };

export type ShareErrorCode =
  | "invalidJson"
  | "notObject"
  | "wrongFormat"
  | "wrongVersion"
  | "missingExercise"
  | "missingName"
  | "urlRequired"
  | "urlProtocol"
  | "unreachable"
  | "badStatus";

export class ShareError extends Error {
  constructor(
    readonly code: ShareErrorCode,
    readonly detail = "",
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ShareError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toPortable(
  exercise: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    PORTABLE_FIELDS.filter((key) => exercise[key] != null).map((key) => [
      key,
      exercise[key],
    ]),
  );
}

export function buildExerciseShare(
  exercise: object,
  now: Date = new Date(),
): { filename: string; json: string } {
  const source = exercise as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name : "";
  const safeName =
    (name || "exercise")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "exercise";
  return {
    filename: `${safeName}.lifttrace-exercise.json`,
    json: JSON.stringify(
      {
        format: FORMAT,
        version: VERSION,
        exportedAt: now.toISOString(),
        exercise: toPortable(source),
      },
      null,
      2,
    ),
  };
}

/** The importable fields of a file's text, or a ShareError */
export function parseSharePayload(raw: unknown): PortableExercise {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      throw new ShareError("invalidJson");
    }
  }
  if (!isRecord(data)) throw new ShareError("notObject");
  if (data.format !== FORMAT) throw new ShareError("wrongFormat");
  if (data.version !== VERSION) {
    throw new ShareError("wrongVersion", String(data.version));
  }
  const { exercise } = data;
  if (!isRecord(exercise)) throw new ShareError("missingExercise");
  if (!exercise.name || typeof exercise.name !== "string") {
    throw new ShareError("missingName");
  }
  return toPortable(exercise) as PortableExercise;
}

/** github.com/<user>/<repo>/blob/<ref>/<path> → raw.githubusercontent.com */
export function rawFileUrl(input: string): string {
  const url = input.trim();
  if (!url) throw new ShareError("urlRequired");
  if (!/^https?:\/\//i.test(url)) throw new ShareError("urlProtocol");
  const blob = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i.exec(
    url,
  );
  return blob
    ? `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`
    : url;
}

export async function fetchSharedExercise(
  input: string,
  doFetch: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<PortableExercise> {
  const url = rawFileUrl(input);
  let response: Response;
  try {
    response = await doFetch(url, { redirect: "follow" });
  } catch (error) {
    throw new ShareError(
      "unreachable",
      error instanceof Error ? error.message : "",
    );
  }
  if (!response.ok) {
    throw new ShareError(
      "badStatus",
      `${response.status} ${response.statusText}`.trim(),
    );
  }
  return parseSharePayload(await response.text());
}
