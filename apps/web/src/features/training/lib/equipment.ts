/**
 * Equipment normalization, after backends/lifttrace/src/lib/equipment.js:
 * the raw strings of the exercise sources fall into six filter buckets.
 */
import { toText } from "./searchText";

/** The buckets, in the order the filter chips show them */
export const EQUIPMENT_BUCKETS = [
  "Barbell",
  "Bodyweight",
  "Dumbbell",
  "Cable",
  "Machine",
  "Other",
] as const;

const PATTERNS: { bucket: string; pattern: RegExp }[] = [
  {
    bucket: "Barbell",
    pattern:
      /(^|\W)(barbell|e-?z.?(curl.?)?bar|sz.?bar|smith|trap.?bar|olympic|deadlift.?bar|squat.?bar|hex.?bar)(\W|$)/i,
  },
  { bucket: "Dumbbell", pattern: /(^|\W)(dumbbell|db)(\W|$)/i },
  { bucket: "Cable", pattern: /(^|\W)(cable|pulley|tower|crossover)(\W|$)/i },
  {
    bucket: "Machine",
    pattern:
      /(^|\W)(machine|leverage|hammer\s*strength|lever|sled|selectorized|plate.?loaded|weighted)(\W|$)/i,
  },
  {
    bucket: "Bodyweight",
    pattern:
      /(^|\W)(body\s?weight|body\s?only|bodyweight|none|assisted|calisthenics)(\W|$)/i,
  },
];

/** The bucket of a raw equipment string; "" for no input */
export function normalizeEquipment(name: unknown): string {
  const raw = toText(name).trim();
  if (!raw) return "";
  return PATTERNS.find(({ pattern }) => pattern.test(raw))?.bucket ?? "Other";
}

/** Bucket order first, unknown names after it by alphabet */
export function sortByBucket(a: string, b: string): number {
  const order: readonly string[] = EQUIPMENT_BUCKETS;
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}
