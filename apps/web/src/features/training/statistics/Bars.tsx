import { Meter, Panel, Stack, Text } from "@monocircuit/monolithium/components";

export interface Bar {
  id: string;
  label: string;
  value: number;
  valueText: string;
  /** Muted bars missed the target */
  isHighlighted?: boolean;
}

export interface BarsProps {
  title?: string;
  description?: string;
  bars: Bar[];
  /** The full length of a bar; at least the largest value */
  target?: number;
  footer?: string;
}

/** Values to compare, one labelled bar each */
// TODO(monolithium): a bar chart (columns over time with a target line)
export function Bars({ title, description, bars, target, footer }: BarsProps) {
  const max = Math.max(target ?? 0, ...bars.map((bar) => bar.value), 1);
  return (
    <Panel title={title} description={description}>
      <Stack gap={2}>
        {bars.map((bar) => (
          <Meter
            key={bar.id}
            size="sm"
            label={bar.label}
            value={bar.value}
            max={max}
            valueText={bar.valueText}
            tone={bar.isHighlighted === false ? "muted" : "accent"}
          />
        ))}
        {footer && (
          <Text variant="caption" tone="muted">
            {footer}
          </Text>
        )}
      </Stack>
    </Panel>
  );
}
