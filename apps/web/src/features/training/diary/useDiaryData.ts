/**
 * What the diary reads besides the day's workout: histories (last time,
 * records), the trained days, recent workouts, the active program, the
 * coach's prescriptions and feedback, and the day's clips.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/api";

import { previousBest, type PreviousBest } from "../lib/prs";
import { lastCompletedSession } from "../lib/workout";
import type {
  CoachFeedback,
  HistoryEntry,
  LastSession,
  WorkoutLog,
} from "../lib/workoutTypes";
import {
  feedbackApi,
  prescriptionApi,
  programApi,
  workoutApi,
  type InboxRow,
  type Prescription,
  type Program,
} from "./api";
import { setMediaApi, type SetMedia } from "./setMediaApi";

/**
 * A loaded value that a failed request leaves at `empty`. `key` names what
 * is asked for: a new key empties it at once, `reload` keeps it meanwhile.
 */
function useLoaded<T>(
  key: string | null,
  load: () => Promise<T>,
  empty: T,
): { value: T; reload: () => void; patch: (change: (value: T) => T) => void } {
  const [state, setState] = useState<{ key: string | null; value: T }>({
    key: null,
    value: empty,
  });
  const [tick, setTick] = useState(0);
  const loader = useRef(load);
  const [fallback] = useState(() => empty);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let isStale = false;
    loader
      .current()
      .then((value) => {
        if (!isStale) setState({ key, value });
      })
      .catch(() => {
        if (!isStale) setState({ key, value: fallback });
      });
    return () => {
      isStale = true;
    };
  }, [key, tick, fallback]);

  const reload = useCallback(() => {
    setTick((n) => n + 1);
  }, []);
  const patch = useCallback((change: (value: T) => T) => {
    setState((current) => ({ ...current, value: change(current.value) }));
  }, []);
  return {
    value: key !== null && state.key === key ? state.value : fallback,
    reload,
    patch,
  };
}

/** Each exercise's history, fetched once per day shown */
export function useHistories(date: string, ids: number[]) {
  const [byKey, setByKey] = useState<Record<string, HistoryEntry[]>>({});
  const requested = useRef(new Set<string>());
  const wanted = [...new Set(ids)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    for (const id of wanted ? wanted.split(",").map(Number) : []) {
      const key = `${date}|${id}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      workoutApi
        .history(id)
        .then((history) => {
          setByKey((current) => ({ ...current, [key]: history }));
        })
        .catch(() => {
          requested.current.delete(key);
        });
    }
  }, [date, wanted]);

  return useMemo(() => {
    const lastSessions = new Map<number, LastSession>();
    const bests: Record<string, PreviousBest> = {};
    for (const id of wanted ? wanted.split(",").map(Number) : []) {
      const key = `${date}|${id}`;
      if (!(key in byKey)) continue;
      const history = byKey[key];
      // Days before this one only: today's own sets are not "last time"
      const last = lastCompletedSession(history, { before: date });
      if (last) lastSessions.set(id, last);
      bests[String(id)] = previousBest(history, date);
    }
    return { lastSessions, bests };
  }, [byKey, date, wanted]);
}

const hasCompletedSet = (log: WorkoutLog) =>
  log.exercises.some((e) => (e.sets ?? []).some((s) => s.completed));

/** Days with a completed set, plus cardio days when cardio is on */
export function useActiveDates(hasCardio: boolean) {
  const lifted = useLoaded<string[]>(
    "lifted",
    async () =>
      (await workoutApi.recent(365))
        .filter(hasCompletedSet)
        .flatMap((w) => (w.date ? [w.date] : [])),
    [],
  );
  const cardio = useLoaded<string[]>(
    hasCardio ? "cardio" : null,
    async () =>
      (await api.lt.get<{ date: string }[]>("/cardio")).map((r) => r.date),
    [],
  );
  const dates = useMemo(
    () => new Set([...lifted.value, ...cardio.value]),
    [lifted.value, cardio.value],
  );
  const reloadLifted = lifted.reload;
  const reloadCardio = cardio.reload;
  const reload = useCallback(() => {
    reloadLifted();
    reloadCardio();
  }, [reloadLifted, reloadCardio]);
  return { dates, reload };
}

export function useRecentWorkouts() {
  return useLoaded<WorkoutLog[]>(
    "recent",
    async () =>
      (await workoutApi.recent(3)).filter((w) => w.exercises.length > 0),
    [],
  );
}

export function useActiveProgram() {
  return useLoaded<Program | null>(
    "active",
    async () => (await programApi.list()).find((p) => p.is_active) ?? null,
    null,
  ).value;
}

export function useDayPrescription(date: string) {
  return useLoaded<Prescription | null>(
    date,
    () => prescriptionApi.forDate(date),
    null,
  );
}

export function useUpcomingPrescriptions() {
  return useLoaded<Prescription[]>(
    "upcoming",
    () => prescriptionApi.upcoming(),
    [],
  );
}

export function useDayFeedback(date: string) {
  return useLoaded<CoachFeedback[]>(date, () => workoutApi.feedback(date), []);
}

export function useUnreadFeedbackDates() {
  const loaded = useLoaded<string[]>(
    "unread",
    () => feedbackApi.unreadDates(),
    [],
  );
  const dates = useMemo(() => new Set(loaded.value), [loaded.value]);
  return { dates, count: loaded.value.length, reload: loaded.reload };
}

export function useInbox(isOpen: boolean) {
  return useLoaded<InboxRow[] | null>(
    isOpen ? "inbox" : null,
    () => feedbackApi.inbox(),
    null,
  );
}

export function useDayMedia(date: string) {
  const loaded = useLoaded<SetMedia[]>(
    date,
    async () => (await setMediaApi.listForDate(date)).media,
    [],
  );
  const bySet = useMemo(
    () =>
      new Map(
        loaded.value.flatMap((m) =>
          m.set_uuid ? [[m.set_uuid, m] as const] : [],
        ),
      ),
    [loaded.value],
  );
  return { bySet, reload: loaded.reload };
}
