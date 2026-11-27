/** The "PLAN: …" line of a generated workout (the old `_extractPlan`) */
const PLAN_LINE = /^\s*PLAN:\s*(.+)$/im;

export function extractPlan(reply: string): string | null {
  return PLAN_LINE.exec(reply)?.[1]?.trim() || null;
}
