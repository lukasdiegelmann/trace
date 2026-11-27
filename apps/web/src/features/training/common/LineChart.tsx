import {
  Dot,
  Row,
  Sparkline,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";

export interface ChartLine {
  label: string;
  /** x on the shared axis (a day number or a session index) */
  points: { x: number; value: number }[];
  /** This line's own value scale */
  min: number;
  max: number;
  /** A CSS colour from monolithium's tokens */
  color?: string;
  format: (value: number) => string;
}

export interface LineChartProps {
  ariaLabel: string;
  /** One or two lines: the first is scaled on the left, a second right */
  lines: ChartLine[];
  from: number;
  until: number;
  /** What stands under the two ends of the axis */
  start?: string;
  end?: string;
}

const COLORS = ["var(--color-accent)", "var(--color-warning)"];

function Scale({ line }: { line: ChartLine }) {
  const values = line.points.map((p) => p.value);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <div className="flex shrink-0 flex-col justify-between">
      <Text variant="caption" tone="muted">
        {line.format(max)}
      </Text>
      {min !== max && (
        <Text variant="caption" tone="muted">
          {line.format(min)}
        </Text>
      )}
    </div>
  );
}

/**
 * Lines over one shared x axis, each with its own y scale, so two measures
 * sit over the same days.
 */
// TODO(monolithium): a chart with a numeric time axis, a free y domain per
// series, point markers and a legend (TimeSeriesChart spaces points by index
// and always starts at zero; Sparkline has no markers or axis labels).
export function LineChart({
  ariaLabel,
  lines,
  from,
  until,
  start,
  end,
}: LineChartProps) {
  const first = lines.at(0);
  const second = lines.at(1);
  // A single moment still needs an axis to sit in the middle of.
  const [low, high] = from === until ? [from - 1, until + 1] : [from, until];
  return (
    <Stack gap={2}>
      <div className="flex h-40 gap-2" role="img" aria-label={ariaLabel}>
        {first && <Scale line={first} />}
        <div className="relative min-w-0 flex-1">
          {lines.map((line, index) => (
            <div key={line.label} className="absolute inset-0">
              <Sparkline
                points={line.points}
                min={line.min}
                max={line.max}
                from={low}
                until={high}
                height={160}
                color={line.color ?? COLORS[index]}
              />
            </div>
          ))}
        </div>
        {second && <Scale line={second} />}
      </div>
      {(start || end) && (
        <Row justify="between" gap={2} className="flex-wrap">
          <Text variant="caption" tone="muted">
            {start}
          </Text>
          <Text variant="caption" tone="muted">
            {end}
          </Text>
        </Row>
      )}
      {lines.length > 1 && (
        <Row gap={4} className="flex-wrap">
          {lines.map((line, index) => (
            <Row key={line.label} gap={2} align="center">
              <Dot color={line.color ?? COLORS[index]} />
              <Text variant="caption">{line.label}</Text>
            </Row>
          ))}
        </Row>
      )}
    </Stack>
  );
}
