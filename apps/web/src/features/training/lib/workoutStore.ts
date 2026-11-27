/**
 * The diary's workout of one day, ported from LiftTrace
 * `stores/workout.js`: optimistic changes, saves debounced by 350 ms and
 * merged with a fresh copy from the server (uuid merge, tombstones against
 * the copy read at load), several sessions per day (issue #76), and an epoch
 * that keeps a late save from putting an abandoned workout back on screen
 * (issue #86). The Android offline layer is native-only and not ported.
 *
 * Unlike the old store, saves run one after another, every caller's promise
 * settles, and a waiting save of another workout is sent at once instead of
 * being replaced.
 */
import { createStore, type Store } from "./store";
import { detailsToSave, EditLog } from "./workoutEdits";
import {
  diffTombstones,
  ensureExerciseUuids,
  type Tombstones,
} from "./workoutUuid";
import type { WorkoutExercise, WorkoutLog } from "./workoutTypes";

export const SAVE_DELAY_MS = 350;

export type SaveBody = WorkoutLog & {
  deleted_uuids?: Tombstones;
  changed_uuids?: { exercises: string[]; sets: Record<string, string[]> };
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the backend's key
  new_session?: boolean;
};

/** The workout endpoints the store needs (diary/api.ts `workoutApi`) */
export interface WorkoutBackend {
  get: (
    date: string,
    id?: number | null,
  ) => Promise<{ workout: WorkoutLog | null }>;
  sessions: (date: string) => Promise<{ sessions: WorkoutLog[] }>;
  save: (
    date: string,
    body: SaveBody,
  ) => Promise<{ workout: WorkoutLog | null }>;
  remove: (date: string, id?: number | null) => Promise<unknown>;
}

export interface DiaryState {
  date: string;
  log: WorkoutLog | null;
  /** Every session of the day, for the tabs */
  sessions: WorkoutLog[];
  sessionId: number | null;
  isLoading: boolean;
  loadError: Error | null;
}

interface Waiter {
  resolve: (log: WorkoutLog) => void;
  reject: (error: unknown) => void;
}

interface Pending {
  date: string;
  key: string;
  entry: WorkoutLog;
  epoch: number;
  waiters: Waiter[];
  timer: ReturnType<typeof setTimeout>;
}

const keyOf = (date: string, id: number | null | undefined) =>
  id != null ? `${date}:${id}` : date;

export interface WorkoutStore {
  state: Store<DiaryState>;
  /** Shows a day: its default session, or the one asked for */
  load: (date: string, sessionId?: number | null) => Promise<void>;
  loadSessions: (date: string) => Promise<void>;
  switchSession: (date: string, sessionId: number) => Promise<void>;
  /** Shows the change at once and saves it after SAVE_DELAY_MS */
  save: (date: string, entry: WorkoutLog) => Promise<WorkoutLog>;
  /** Sends a waiting save now */
  flush: () => Promise<void>;
  startNewSession: (date: string, seed: WorkoutLog) => Promise<WorkoutLog>;
  deleteSession: (date: string, sessionId: number | null) => Promise<void>;
  /**
   * Shows what something outside the diary (the assistant) saved, without
   * reading it back (old `showWorkout`). A change of that workout still
   * waiting to save is left to save as it is.
   */
  show: (date: string, workout: WorkoutLog) => void;
  /** Merges feedback into the shown workout (it is not saved) */
  patchShown: (patch: (log: WorkoutLog) => WorkoutLog) => void;
  hasPendingSave: () => boolean;
}

export function createWorkoutStore(
  backend: WorkoutBackend,
  today: string,
): WorkoutStore {
  const state = createStore<DiaryState>({
    date: today,
    log: null,
    sessions: [],
    sessionId: null,
    isLoading: true,
    loadError: null,
  });
  const snapshots = new Map<string, WorkoutExercise[]>();
  const edits = new EditLog();
  let pending: Pending | null = null;
  /** Saves and deletes, one after another */
  let queue: Promise<unknown> = Promise.resolve();
  let epoch = 0;
  let loads = 0;

  const patch = (next: Partial<DiaryState>) => {
    state.set({ ...state.get(), ...next });
  };

  const snapshot = (date: string, log: WorkoutLog | null) => {
    snapshots.set(keyOf(date, log?.id), log?.exercises ?? []);
  };

  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const result = queue.then(job);
    queue = result.catch(() => undefined);
    return result;
  };

  async function loadSessions(date: string): Promise<void> {
    try {
      const data = await backend.sessions(date);
      if (state.get().date === date) patch({ sessions: data.sessions });
    } catch {
      if (state.get().date === date) patch({ sessions: [] });
    }
  }

  async function mergeAndSave(
    date: string,
    entry: WorkoutLog,
  ): Promise<WorkoutLog | null> {
    const sessionId = entry.id ?? null;
    let server: WorkoutLog | null = null;
    try {
      server = (await backend.get(date, sessionId)).workout;
    } catch {
      // Saved without the merge: the server still merges by uuid
    }
    const exercises = ensureExerciseUuids(entry.exercises);
    const key = keyOf(date, sessionId);
    // Deletions are measured against the copy read at load, never the fresh
    // one: what another device added since must not be tombstoned.
    const deleted = diffTombstones(snapshots.get(key), exercises);
    const mine = edits.pending(key);
    const body: SaveBody = server
      ? {
          ...server,
          ...entry,
          ...detailsToSave(entry, server, mine.fields),
          exercises,
          deleted_uuids: deleted,
          changed_uuids: { exercises: mine.exercises, sets: mine.sets },
        }
      : { ...entry, exercises, deleted_uuids: deleted };
    const { workout } = await backend.save(date, body);
    if (workout) {
      edits.saved(key, mine.upTo);
      const savedKey = keyOf(date, workout.id);
      if (savedKey !== key) edits.saved(savedKey, mine.upTo);
      snapshot(date, workout);
      // A day's first save: a change made before the id was known diffs
      // against what is on the server now, too
      if (sessionId == null) snapshots.set(key, workout.exercises);
    }
    return workout;
  }

  function send(job: Pending): Promise<void> {
    clearTimeout(job.timer);
    if (pending === job) pending = null;
    return enqueue(() => mergeAndSave(job.date, job.entry)).then(
      (saved) => {
        const current = state.get();
        // Only when nothing newer waits and the same workout is shown
        if (
          saved &&
          !pending &&
          job.epoch === epoch &&
          current.date === job.date
        ) {
          patch({
            log: {
              ...saved,
              feedback: current.log?.feedback ?? saved.feedback,
            },
            sessionId: saved.id ?? null,
          });
          void loadSessions(job.date);
        }
        for (const waiter of job.waiters) waiter.resolve(saved ?? job.entry);
      },
      (error: unknown) => {
        for (const waiter of job.waiters) waiter.reject(error);
      },
    );
  }

  function flush(): Promise<void> {
    return pending ? send(pending) : queue.then(() => undefined);
  }

  async function load(
    date: string,
    sessionId: number | null = null,
  ): Promise<void> {
    epoch++;
    const ticket = ++loads;
    const isSameDay =
      state.get().date === date && state.get().sessionId != null;
    patch({
      date,
      isLoading: true,
      loadError: null,
      ...(isSameDay ? {} : { log: null, sessions: [], sessionId: null }),
    });
    // A waiting or running save of this day answers first
    await flush();
    try {
      let data = await backend.get(date, sessionId);
      if (sessionId != null && !data.workout) data = await backend.get(date);
      if (ticket !== loads) return;
      snapshot(date, data.workout);
      patch({
        log: data.workout,
        sessionId: data.workout?.id ?? null,
        isLoading: false,
      });
    } catch (error) {
      if (ticket !== loads) return;
      patch({
        log: null,
        sessionId: null,
        isLoading: false,
        loadError: error instanceof Error ? error : new Error(String(error)),
      });
      return;
    }
    await loadSessions(date);
  }

  return {
    state,
    load,
    loadSessions,
    flush,
    hasPendingSave: () => pending !== null,

    switchSession: (date, sessionId) => load(date, sessionId),

    save(date, entry) {
      const stamped: WorkoutLog = {
        ...entry,
        exercises: ensureExerciseUuids(entry.exercises),
      };
      const key = keyOf(date, stamped.id);
      const shown = state.get();
      const before =
        shown.date === date &&
        shown.log &&
        (shown.log.id ?? null) === (stamped.id ?? null)
          ? shown.log
          : null;
      edits.note(key, before, stamped);
      if (shown.date === date) patch({ log: stamped });

      // A waiting save of another workout goes now; this one doesn't replace it
      if (pending && pending.key !== key) void send(pending);
      return new Promise<WorkoutLog>((resolve, reject) => {
        const waiters = pending?.waiters ?? [];
        if (pending) clearTimeout(pending.timer);
        waiters.push({ resolve, reject });
        const job: Pending = {
          date,
          key,
          entry: stamped,
          epoch,
          waiters,
          timer: setTimeout(() => void send(job), SAVE_DELAY_MS),
        };
        pending = job;
      });
    },

    async startNewSession(date, seed) {
      await flush();
      epoch++;
      const fresh = { ...seed };
      delete fresh.id;
      const body: SaveBody = {
        ...fresh,
        exercises: ensureExerciseUuids(seed.exercises),
        new_session: true,
      };
      const saved = await enqueue(() => backend.save(date, body));
      // An answer without the workout must never blank the diary (#102)
      const workout = saved.workout ?? body;
      snapshot(date, saved.workout);
      if (state.get().date === date) {
        patch({ log: workout, sessionId: saved.workout?.id ?? null });
      }
      await loadSessions(date);
      return workout;
    },

    async deleteSession(date, sessionId) {
      const isShown =
        state.get().date === date &&
        (sessionId == null || sessionId === state.get().sessionId);
      // A save still waiting for the deleted workout would bring it back
      if (pending && pending.key === keyOf(date, sessionId)) {
        clearTimeout(pending.timer);
        for (const waiter of pending.waiters) waiter.resolve(pending.entry);
        pending = null;
      }
      await flush();
      if (isShown) epoch++;
      await enqueue(() => backend.remove(date, sessionId));
      if (isShown) await load(date);
      else await loadSessions(date);
    },

    show(date, workout) {
      const current = state.get();
      if (workout.id == null || current.date !== date) return;
      if (pending?.date === date && pending.entry.id === workout.id) return;
      // Neither a running load nor a late save may put the older copy back
      epoch++;
      loads++;
      snapshot(date, workout);
      patch({
        log: {
          ...workout,
          feedback:
            current.log?.id === workout.id
              ? (current.log.feedback ?? workout.feedback)
              : workout.feedback,
        },
        sessionId: workout.id,
        isLoading: false,
        loadError: null,
      });
    },

    patchShown(change) {
      const { log } = state.get();
      if (log) patch({ log: change(log) });
    },
  };
}
