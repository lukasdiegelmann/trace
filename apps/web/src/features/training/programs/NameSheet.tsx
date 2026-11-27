import {
  Button,
  Input,
  Row,
  Sheet,
  Stack,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface NameSheetProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initialName?: string;
  confirmText: string;
  onClose: () => void;
  /** Resolves true to close the sheet */
  onConfirm: (name: string) => Promise<boolean>;
}

/** A sheet asking for one name: rename a program, add a workout */
export function NameSheet(props: NameSheetProps) {
  return (
    <Sheet
      isOpen={props.isOpen}
      title={props.title}
      onOpenChange={(isUp) => {
        if (!isUp) props.onClose();
      }}
    >
      {props.isOpen && <NameForm {...props} />}
    </Sheet>
  );
}

function NameForm({
  label,
  placeholder,
  initialName = "",
  confirmText,
  onClose,
  onConfirm,
}: NameSheetProps) {
  const { t } = useTranslation("training");
  const [name, setName] = useState(initialName);
  const [isBusy, setIsBusy] = useState(false);

  const confirm = async () => {
    const next = name.trim();
    if (!next || isBusy) return;
    setIsBusy(true);
    if (await onConfirm(next)) onClose();
    else setIsBusy(false);
  };

  return (
    <Stack gap={4}>
      <Input
        label={label}
        placeholder={placeholder}
        value={name}
        maxLength={120}
        onValueChange={setName}
        onEnter={() => void confirm()}
        autoFocus
      />
      <Row gap={2} justify="end">
        <Button text={t("common.cancel")} onClick={onClose} />
        <Button
          variant="primary"
          text={confirmText}
          isLoading={isBusy}
          isDisabled={!name.trim()}
          onClick={() => void confirm()}
        />
      </Row>
    </Stack>
  );
}
