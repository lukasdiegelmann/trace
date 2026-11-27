import { Checkbox, Stack, Text } from "@monocircuit/monolithium/components";

export interface ToggleRowProps {
  label: string;
  hint?: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}

/** A setting that is on or off, with what it does below */
export function ToggleRow({
  label,
  hint,
  isChecked,
  onChange,
}: ToggleRowProps) {
  // TODO(monolithium): a switch (toggle) for settings; Checkbox until then.
  return (
    <Stack gap={1} align="start">
      <Checkbox label={label} checked={isChecked} onChange={onChange} />
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </Stack>
  );
}
