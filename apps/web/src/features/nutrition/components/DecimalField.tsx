import { Input } from "@monocircuit/monolithium/components";

export interface DecimalFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  /** Focuses the field and selects its text */
  hasAutoFocus?: boolean;
  isDisabled?: boolean;
  error?: string;
  placeholder?: string;
}

/** A text field for a number, typed with "." or "," */
export function DecimalField({
  label,
  value,
  onChange,
  onEnter,
  hasAutoFocus,
  isDisabled,
  error,
  placeholder,
}: DecimalFieldProps) {
  return (
    <Input
      label={label}
      inputMode="decimal"
      value={value}
      onValueChange={onChange}
      onEnter={onEnter}
      autoFocus={hasAutoFocus}
      onFocus={
        hasAutoFocus
          ? (event) => {
              event.target.select();
            }
          : undefined
      }
      disabled={isDisabled}
      error={error}
      placeholder={placeholder}
      fieldSize="lg"
    />
  );
}
