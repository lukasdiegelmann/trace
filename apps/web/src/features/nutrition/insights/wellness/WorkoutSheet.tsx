import {
  Button,
  Legend,
  Meter,
  Sheet,
  Spinner,
  Stack,
  Stat,
  Text,
  TimeSeriesChart,
} from "@monocircuit/monolithium/components";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { displayEnergy } from "../../lib/insights/nutrition";
import {
  downsample,
  heartRateShares,
  type HeartRateZone,
} from "../../lib/insights/route";
import { chartBaseline } from "../../lib/insights/statistics";
import { formatDistance, formatDuration } from "../../lib/insights/wellness";
import { loadGps, type GpsPoint, type Workout } from "../api";
import { useAsync } from "../useAsync";
import { useInsightsT } from "../useInsightsT";

/** The original route colours: below 130, 130–150, 150–170, above 170 bpm */
const ZONE_COLORS: Record<HeartRateZone, string> = {
  easy: "var(--color-incoming)",
  moderate: "var(--color-success)",
  hard: "var(--color-warning)",
  peak: "var(--color-destructive)",
};

const CHART_POINTS = 200;

export interface WorkoutSheetProps {
  workout: Workout;
  date: string;
  distUnit: string;
  energyUnit: string;
  timeFormat: string;
  onClose: () => void;
}

function RouteChart({
  points,
  read,
  label,
}: {
  points: GpsPoint[];
  read: (p: GpsPoint) => number | null;
  label: string;
}) {
  const { locale } = useInsightsT();
  const known = points.flatMap((p, index) => {
    const value = read(p);
    return value === null ? [] : [{ x: p.time ?? index, value }];
  });
  if (known.length < 2) return null;
  const shown = downsample(known, CHART_POINTS);
  const baseline = chartBaseline(
    shown.map((p) => p.value),
    false,
  );
  return (
    <Stack gap={1}>
      <Text variant="label">{label}</Text>
      <TimeSeriesChart
        ariaLabel={label}
        valueLabel={label}
        height={140}
        data={shown.map((p) => ({ x: p.x, value: p.value - baseline }))}
        formatValue={(v) => Math.round(v + baseline).toLocaleString(locale)}
        formatX={(time) =>
          time.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })
        }
      />
    </Stack>
  );
}

/** The GPS route, shown as heart rate and altitude over time */
function Route({ workout }: { workout: Workout }) {
  const { t } = useInsightsT();
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(async () => {
    const points = workout.gps_data ?? (await loadGps(workout.source_id));
    return { points, attempt };
  }, [workout, attempt]);
  const { data, isLoading } = useAsync(load);

  if (isLoading) {
    return <Spinner label={t("wellness.workouts.loadingRoute")} />;
  }
  const points = data?.points;
  if (!points || points.length < 2) {
    return (
      <Stack gap={2} align="center">
        <Text variant="small" tone="muted">
          {t("wellness.workouts.noRoute")}
        </Text>
        <Button
          size="sm"
          variant="secondary"
          text={t("common.retry")}
          onClick={() => {
            setAttempt((a) => a + 1);
          }}
        >
          <RefreshCw aria-hidden size={14} />
        </Button>
      </Stack>
    );
  }
  const shares = heartRateShares(points);
  // TODO(monolithium): a map with a route, coloured by heart-rate zone.
  return (
    <Stack gap={3}>
      <RouteChart
        points={points}
        read={(p) => p.hr}
        label={t("wellness.workouts.heartRate")}
      />
      {shares ? (
        <Stack gap={1}>
          <Meter
            max={100}
            label={t("wellness.workouts.zones")}
            segments={shares.map((s) => ({
              value: s.pct,
              color: ZONE_COLORS[s.zone],
            }))}
          />
          <Legend
            items={shares.map((s) => ({
              label: `${t(`wellness.workouts.zone.${s.zone}`)} · ${Math.round(s.pct)} %`,
              color: ZONE_COLORS[s.zone],
            }))}
          />
        </Stack>
      ) : null}
      <RouteChart
        points={points}
        read={(p) => p.alt}
        label={t("wellness.workouts.altitude")}
      />
    </Stack>
  );
}

export function WorkoutSheet({
  workout: w,
  date,
  distUnit,
  energyUnit,
  timeFormat,
  onClose,
}: WorkoutSheetProps) {
  const { t, locale } = useInsightsT();
  const start = w.start_time
    ? new Date(w.start_time).toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: timeFormat !== "24h",
      })
    : date;
  const energy = w.calories ? displayEnergy(w.calories, energyUnit) : null;
  const distance =
    w.distance_km === null
      ? null
      : formatDistance(w.distance_km, distUnit, locale);
  const stats = [
    { id: "duration", value: formatDuration(w.duration_ms) },
    distance && {
      id: "distance",
      value: `${distance.value} ${distance.unit}`,
    },
    energy && {
      id: "energy",
      value: `${energy.value.toLocaleString(locale)} ${energy.unit}`,
    },
    w.steps ? { id: "steps", value: w.steps.toLocaleString(locale) } : null,
    w.avg_hr ? { id: "avgHr", value: String(w.avg_hr) } : null,
    w.max_hr ? { id: "peakHr", value: String(w.max_hr) } : null,
  ].filter((s): s is { id: string; value: string } => !!s);

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={w.activity_name ?? t("wellness.workouts.unnamed")}
      description={start}
    >
      <Stack gap={4}>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <Stat
              key={s.id}
              label={t(`wellness.workouts.stats.${s.id}`)}
              value={s.value}
            />
          ))}
        </div>
        {w.has_gps ? <Route workout={w} /> : null}
      </Stack>
    </Sheet>
  );
}
