/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON shapes */
/**
 * Which recipes a smart cookbook holds, from cooktrace's
 * lib/smart-cookbook.js. The server evaluates the filter itself; the
 * frontend only reads it for the chips of the cookbook screen.
 */
export interface SmartFilter {
  category_id?: number;
  tags?: string[];
  favorites_only?: boolean;
  min_rating?: number;
  max_total_minutes?: number;
}

export function parseSmartFilter(json: unknown): SmartFilter | null {
  if (json === null || json === undefined || json === "") return null;
  if (typeof json === "object") return json;
  if (typeof json !== "string") return null;
  try {
    return JSON.parse(json) as SmartFilter;
  } catch {
    return null;
  }
}
