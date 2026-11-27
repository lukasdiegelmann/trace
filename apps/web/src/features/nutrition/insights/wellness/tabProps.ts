import type {
  DayMetrics,
  EnabledSources,
  FormatSettings,
} from "../../lib/insights/wellness";

/** What the activity, sleep and heart tabs share */
export interface MetricTabProps {
  /** The merged values of the shown day */
  data: DayMetrics;
  wellnessMetrics: string[] | null;
  sources: EnabledSources;
  /** The last 7 days per metric */
  series: Record<string, (number | null)[]>;
  format: FormatSettings;
  celebrating: string[];
  isLoading: boolean;
  /** Opens a Statistics series */
  onTrend: (statsMetric: string) => void;
}
