import { Input } from "@monocircuit/monolithium/components";
import { useState } from "react";

export interface DraftInputProps {
  /** The stored value as the field shows it */
  value: string;
  /** Called on every keystroke with what is typed */
  onDraft: (text: string) => void;
  label: string;
  /** How typed text is reshaped while typing (the duration mask) */
  mask?: (text: string) => string;
  inputMode?: "decimal" | "numeric" | "text";
  placeholder?: string;
  className?: string;
}

/**
 * A field that saves as you type but is never overwritten while focused, so a
 * save's answer can't reformat a half-typed "1." (the old SetRow's clobber
 * guard). Focusing selects the value: the first keystroke replaces it.
 */
export function DraftInput({
  value,
  onDraft,
  label,
  mask,
  inputMode = "decimal",
  placeholder = "0",
  className,
}: DraftInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    // TODO(monolithium): a compact number field with its label only for screen readers
    <Input
      aria-label={label}
      value={draft ?? value}
      inputMode={inputMode}
      placeholder={placeholder}
      autoComplete="off"
      fieldSize="sm"
      wrapperClassName={className}
      onFocus={(event) => {
        setDraft(value);
        event.target.select();
      }}
      onValueChange={(text) => {
        const next = mask ? mask(text) : text;
        setDraft(next);
        onDraft(next);
      }}
      onBlur={() => {
        setDraft(null);
      }}
      onEnter={() => {
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    />
  );
}
