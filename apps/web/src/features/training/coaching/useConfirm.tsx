import { Dialog } from "@monocircuit/monolithium/components";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  isDangerous?: boolean;
}

interface Question extends ConfirmOptions {
  resolve: (isConfirmed: boolean) => void;
}

/** `if (!(await confirm({...}))) return;` with `dialog` rendered once */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const { t } = useTranslation("training");
  const [question, setQuestion] = useState<Question | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setQuestion({ ...options, resolve });
      }),
    [],
  );

  const answer = (isConfirmed: boolean) => {
    question?.resolve(isConfirmed);
    setQuestion(null);
  };

  const dialog = question ? (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) answer(false);
      }}
      title={question.title}
      description={question.message}
      confirmText={question.confirmText}
      cancelText={t("common.cancel")}
      variant={question.isDangerous ? "danger" : "default"}
      onConfirm={() => {
        answer(true);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
