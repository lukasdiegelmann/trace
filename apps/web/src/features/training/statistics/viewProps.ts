import type { PeriodDeltas, Range } from "../lib/statistics";
import type { PickableExercise, Statistics } from "./api";

/** What every metric view gets from the screen */
export interface ViewProps {
  data: Statistics;
  exercises: PickableExercise[];
  range: Range;
  rangeLabel: string;
  start: string;
  end: string;
  deltas: PeriodDeltas | null;
}
