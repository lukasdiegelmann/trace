/** Fields bound to one or more settings: the row and its binding in one */
import { useShared, type SettingRef } from "./binding";
import {
  SecretRow,
  SelectRow,
  SwitchRow,
  TextRow,
  type Option,
} from "./fields";

interface Bound {
  refs: [SettingRef, ...SettingRef[]];
  label: string;
  hint?: string;
}

export function BoundSwitch({
  refs,
  label,
  hint,
  isDisabled,
  onChanged,
}: Bound & { isDisabled?: boolean; onChanged?: (isOn: boolean) => void }) {
  const [isOn, setOn] = useShared<boolean>(...refs);
  return (
    <SwitchRow
      label={label}
      hint={hint}
      isDisabled={isDisabled}
      isChecked={isOn}
      onChange={(isNext) => {
        setOn(isNext);
        onChanged?.(isNext);
      }}
    />
  );
}

export function BoundSelect<T extends string | number>({
  refs,
  label,
  hint,
  options,
}: Bound & { options: readonly Option<T>[] }) {
  const [value, setValue] = useShared<T>(...refs);
  return (
    <SelectRow<T>
      label={label}
      hint={hint}
      value={value}
      options={options}
      onChange={setValue}
    />
  );
}

export function BoundText({
  refs,
  label,
  hint,
  type,
  placeholder,
  isDisabled,
  onCommitted,
}: Bound & {
  type?: "text" | "url" | "email" | "time" | "date";
  placeholder?: string;
  isDisabled?: boolean;
  onCommitted?: (value: string) => void;
}) {
  const [value, setValue] = useShared<string | null>(...refs);
  return (
    <TextRow
      label={label}
      hint={hint}
      type={type}
      placeholder={placeholder}
      isDisabled={isDisabled}
      value={value ?? ""}
      onCommit={(next) => {
        setValue(next);
        onCommitted?.(next);
      }}
    />
  );
}

export function BoundSecret({
  refs,
  label,
  hint,
  placeholder,
  onCommitted,
}: Bound & {
  placeholder?: string;
  onCommitted?: (value: string) => void;
}) {
  const [value, setValue] = useShared<string | null>(...refs);
  return (
    <SecretRow
      label={label}
      hint={hint}
      placeholder={placeholder}
      value={value ?? ""}
      onCommit={(next) => {
        setValue(next);
        onCommitted?.(next);
      }}
    />
  );
}
