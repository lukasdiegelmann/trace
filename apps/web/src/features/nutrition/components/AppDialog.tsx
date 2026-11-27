import { Dialog, type DialogProps } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useBackToClose } from "./backStack";

export interface AppDialogProps extends Omit<
  DialogProps,
  "open" | "onOpenChange"
> {
  onClose: () => void;
}

/**
 * monolithium's Dialog the way these screens use it: it is open while it is
 * rendered, has translated button texts, and the browser's Back closes it
 * instead of leaving the page.
 */
export function AppDialog({
  onClose,
  cancelText,
  confirmText,
  ...props
}: AppDialogProps) {
  const { t } = useTranslation("nutrition");
  useBackToClose(true, onClose);
  return (
    <Dialog
      {...props}
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      cancelText={
        cancelText ?? t(props.onConfirm ? "common.cancel" : "common.close")
      }
      confirmText={confirmText ?? t("common.save")}
    />
  );
}
