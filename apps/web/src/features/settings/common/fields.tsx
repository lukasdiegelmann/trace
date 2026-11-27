import {
  Button,
  Checkbox,
  Field,
  InplaceMultiSelect,
  Input,
  Row,
  SegmentedControl,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { parseNumberInput } from "../lib/numbers";

export interface Option<T extends string | number = string> {
  value: T;
  label: string;
  /** Only SelectRow shows an option as unavailable */
  isDisabled?: boolean;
}

export interface SwitchRowProps {
  label: string;
  hint?: string;
  isChecked: boolean;
  onChange: (isOn: boolean) => void;
  isDisabled?: boolean;
}

// TODO(monolithium): a Switch; until then a setting's on/off is a Checkbox.
export function SwitchRow({
  label,
  hint,
  isChecked,
  onChange,
  isDisabled,
}: SwitchRowProps) {
  return (
    <Stack gap={1}>
      <Checkbox
        label={label}
        checked={isChecked}
        onChange={onChange}
        disabled={isDisabled}
      />
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

export interface SelectRowProps<T extends string | number> {
  label: string;
  hint?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  isDisabled?: boolean;
}

/** One of many; the option values keep their type (numbers stay numbers) */
export function SelectRow<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
  isDisabled,
}: SelectRowProps<T>) {
  return (
    <Field label={label} hint={hint}>
      <InplaceMultiSelect
        label={label}
        isFullWidth
        disabled={isDisabled}
        value={String(value)}
        options={options.map((option) => ({
          value: String(option.value),
          label: option.label,
          disabled: option.isDisabled,
        }))}
        onChange={(next: string) => {
          const picked = options.find(
            (option) => String(option.value) === next,
          );
          if (picked) onChange(picked.value);
        }}
      />
    </Field>
  );
}

/** One of a few, all visible */
export function SegmentRow<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: SelectRowProps<T>) {
  return (
    <Field label={label} hint={hint}>
      <Row>
        <SegmentedControl<T>
          aria-label={label}
          options={[...options]}
          value={value}
          onChange={onChange}
        />
      </Row>
    </Field>
  );
}

export interface TextRowProps {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  /** Called on blur and on Enter, only when the text changed */
  onCommit: (value: string) => void;
  /** Commits every keystroke, where a button beside the field waits for it */
  isLive?: boolean;
  /** Enter, after the text is committed; with `isLive` the state is current */
  onSubmit?: () => void;
  type?: "text" | "url" | "email" | "password" | "time" | "date" | "tel";
  placeholder?: string;
  isDisabled?: boolean;
  isMultiline?: boolean;
  inputMode?: "text" | "decimal" | "numeric" | "url" | "email";
  /** After the field, in its row, e.g. a show/hide button */
  after?: ReactNode;
  autoComplete?: string;
}

/**
 * A text setting: typing stays local, the setting is written once when the
 * field is left or Enter is pressed (the old UIs saved on blur too).
 */
export function TextRow({
  label,
  hint,
  error,
  value,
  onCommit,
  type = "text",
  placeholder,
  isDisabled,
  isMultiline,
  inputMode,
  after,
  autoComplete = "off",
  isLive,
  onSubmit,
}: TextRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <Row gap={2} align="center">
          <div className="min-w-0 flex-1">
            <Input
              {...control}
              aria-label={label}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              disabled={isDisabled}
              multiline={isMultiline}
              autoComplete={autoComplete}
              value={draft ?? value}
              onChange={(event) => {
                if (isLive) onCommit(event.target.value);
                else setDraft(event.target.value);
              }}
              onBlur={commit}
              onEnter={() => {
                commit();
                onSubmit?.();
              }}
            />
          </div>
          {after}
        </Row>
      )}
    </Field>
  );
}

/** A key, token or password: hidden until the eye is pressed */
export function SecretRow(props: Omit<TextRowProps, "type" | "after">) {
  const { t } = useTranslation("settings");
  const [isShown, setIsShown] = useState(false);
  const label = isShown ? t("actions.hide") : t("actions.show");
  return (
    <TextRow
      {...props}
      type={isShown ? "text" : "password"}
      autoComplete="new-password"
      after={
        <Button
          variant="ghost"
          size="md"
          aria-label={`${label}: ${props.label}`}
          onClick={() => {
            setIsShown(!isShown);
          }}
        >
          {isShown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      }
    />
  );
}

export interface NumberRowProps {
  label: string;
  hint?: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  /** Taken when the text isn't a number */
  fallback?: number;
  isInteger?: boolean;
  isDisabled?: boolean;
}

export function NumberRow({
  label,
  hint,
  value,
  onCommit,
  isDisabled,
  ...limits
}: NumberRowProps) {
  return (
    <TextRow
      label={label}
      hint={hint}
      isDisabled={isDisabled}
      inputMode={limits.isInteger ? "numeric" : "decimal"}
      value={Number.isFinite(value) ? String(value) : ""}
      onCommit={(text) => {
        const next = parseNumberInput(text, limits);
        if (next !== null) onCommit(next);
      }}
    />
  );
}

export interface CheckListProps<T extends string | number> {
  label: string;
  hint?: string;
  options: readonly Option<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  /** Lays the boxes out side by side */
  isInline?: boolean;
}

/** Several of many; the result keeps the options' order */
export function CheckList<T extends string | number>({
  label,
  hint,
  options,
  values,
  onChange,
  isInline,
}: CheckListProps<T>) {
  const toggle = (value: T, isOn: boolean) => {
    const next = new Set(values);
    if (isOn) next.add(value);
    else next.delete(value);
    onChange(
      options
        .map((option) => option.value)
        .filter((candidate) => next.has(candidate)),
    );
  };
  const boxes = options.map((option) => (
    <Checkbox
      key={option.value}
      label={option.label}
      checked={values.includes(option.value)}
      onChange={(isOn) => {
        toggle(option.value, isOn);
      }}
    />
  ));
  return (
    <Stack gap={2} role="group" aria-label={label}>
      <Text variant="label">{label}</Text>
      {isInline ? (
        <Row gap={4} shouldWrap>
          {boxes}
        </Row>
      ) : (
        boxes
      )}
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
