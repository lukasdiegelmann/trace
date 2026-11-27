import { Dialog, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useCamera } from "./useCamera";

export interface CameraDialogProps {
  onClose: () => void;
  onCapture: (photo: Blob) => void;
}

/** A photo from the camera (webcam on desktop). Mounted while open */
export function CameraDialog({ onClose, onCapture }: CameraDialogProps) {
  const { t } = useTranslation("cooking");
  const { ref, state, capture } = useCamera();
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("cookingCommon.photo.camera")}
      confirmText={t("cookingCommon.photo.capture")}
      cancelText={t("cookingCommon.cancel")}
      isConfirmDisabled={state !== "ready"}
      onConfirm={async () => {
        const photo = await capture();
        if (photo) onCapture(photo);
      }}
    >
      <Stack gap={2}>
        {/* TODO(monolithium): a camera view */}
        <video
          ref={ref}
          muted
          playsInline
          className="w-full rounded-container bg-level-1"
        />
        {state === "unavailable" ? (
          <Text tone="danger" role="alert">
            {t("cookingCommon.photo.cameraDenied")}
          </Text>
        ) : null}
      </Stack>
    </Dialog>
  );
}
