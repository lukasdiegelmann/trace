import { Button } from "@monocircuit/monolithium/components";

export interface ToggleChip {
  value: string;
  label: string;
}

export interface ToggleChipsProps {
  /** Accessible name of the group */
  label: string;
  options: ToggleChip[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** One row that scrolls sideways instead of wrapping */
  isScrolling?: boolean;
}

/** A row of chips that switch on and off (filters, multi-pick fields) */
export function ToggleChips({
  label,
  options,
  selected,
  onToggle,
  isScrolling = false,
}: ToggleChipsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={
        isScrolling ? "flex gap-2 overflow-x-auto" : "flex flex-wrap gap-2"
      }
    >
      {/* TODO(monolithium): a selectable filter chip (Chip has no pressed state or onPress) */}
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Button
            key={option.value}
            size="sm"
            variant={isSelected ? "primary" : "secondary"}
            aria-pressed={isSelected}
            text={option.label}
            className="shrink-0"
            onClick={() => {
              onToggle(option.value);
            }}
          />
        );
      })}
    </div>
  );
}
