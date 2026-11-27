import { Dialog } from "@monocircuit/monolithium/components";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText: string;
  isDangerous?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (isConfirmed: boolean) => void;
}

/**
 * `if (!(await confirm({...}))) return;` Render `dialog` once in the
 * component that asks.
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const { t } = useTranslation("cooking");
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const answer = (isConfirmed: boolean) => {
    pending?.resolve(isConfirmed);
    setPending(null);
  };

  const dialog = pending ? (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) answer(false);
      }}
      title={pending.title}
      description={pending.message}
      confirmText={pending.confirmText}
      cancelText={t("cookingCommon.cancel")}
      variant={pending.isDangerous ? "danger" : "default"}
      onConfirm={() => {
        answer(true);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
