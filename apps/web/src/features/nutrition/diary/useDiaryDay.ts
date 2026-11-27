import { useCallback, useEffect, useRef, useState } from "react";

import type { DiaryDay } from "../api";
import { useNotify } from "../components/useNotify";
import {
  loadDiaryDay,
  mutateDiaryDay,
  subscribeDiaryChanges,
} from "../diaryStore";
import type { DiaryMutation } from "../lib/diary";
import { useResource } from "../useResource";

export interface DiaryDayState {
  day: DiaryDay | null;
  error: Error | null;
  reload: () => void;
  /** Counts writes, so overviews of other days know to reload */
  revision: number;
  /**
   * Applies a change to the day on show. `null`: it failed (already told);
   * `false`: there was nothing to change.
   */
  mutate: (mutation: DiaryMutation) => Promise<boolean | null>;
  /** Shows a day written elsewhere, if it is the one on show */
  replace: (day: DiaryDay) => void;
  bumpRevision: () => void;
}

export function useDiaryDay(date: string): DiaryDayState {
  const notify = useNotify();
  const { data, error, reload, setData } = useResource(date, () =>
    loadDiaryDay(date),
  );
  const [revision, setRevision] = useState(0);
  const shownDate = useRef(date);
  useEffect(() => {
    shownDate.current = date;
  }, [date]);

  const replace = useCallback(
    (day: DiaryDay) => {
      if (day.date === shownDate.current) setData(day);
    },
    [setData],
  );
  const bumpRevision = useCallback(() => {
    setRevision((count) => count + 1);
  }, []);

  useEffect(
    () =>
      subscribeDiaryChanges((changed) => {
        if (changed === shownDate.current) reload();
        bumpRevision();
      }),
    [reload, bumpRevision],
  );

  const mutate = useCallback(
    async (mutation: DiaryMutation) => {
      try {
        const result = await mutateDiaryDay(date, mutation);
        replace(result.day);
        if (result.isChanged) bumpRevision();
        return result.isChanged;
      } catch (caught) {
        notify.failure(caught);
        return null;
      }
    },
    [date, notify, replace, bumpRevision],
  );

  return { day: data, error, reload, revision, mutate, replace, bumpRevision };
}
