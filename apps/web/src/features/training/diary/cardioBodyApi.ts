/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON keys */
/**
 * LiftTrace calls of the cardio card and the body stats (old `LtApi` in
 * `src/lib/api.js` and the raw fetches of `BodyStats.svelte` /
 * `BodyStatsWidget.svelte`). Paths are relative to `/lt/api`.
 */
import { api } from "@/api";

import type { BodyStatValues } from "../lib/bodyStats";
import type { CardioPayload, CardioSession } from "../lib/cardio";

const lt = api.lt;

// ── Cardio ─────────────────────────────────────────────────────────────────

export const cardioApi = {
  byDate: (date: string) => lt.get<CardioSession[]>(`/cardio/${date}`),
  templates: () => lt.get<CardioSession[]>("/cardio/templates"),
  create: (payload: CardioPayload) =>
    lt.post<CardioSession>("/cardio", payload),
  update: (id: number, payload: CardioPayload) =>
    lt.put<CardioSession>(`/cardio/${id}`, payload),
  setTemplate: (id: number, isTemplate: boolean) =>
    lt.put<CardioSession>(`/cardio/${id}`, { is_template: isTemplate ? 1 : 0 }),
  remove: (id: number) => lt.delete<{ ok: boolean }>(`/cardio/${id}`),
};

// ── Body stats ─────────────────────────────────────────────────────────────

/** GET /body-stats/:date; `lib/bodyStats.parseBodyStatsResponse` reads it */
export interface BodyStatsResponse {
  stats: {
    id?: number;
    date?: string;
    stats: BodyStatValues | string;
  } | null;
}

export const bodyStatsApi = {
  get: (date: string) => lt.get<BodyStatsResponse>(`/body-stats/${date}`),
  save: (date: string, stats: BodyStatValues) =>
    lt.put<unknown>(`/body-stats/${date}`, { stats }),
};
