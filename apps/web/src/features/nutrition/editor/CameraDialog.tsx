import { Text } from "@monocircuit/monolithium/components";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";

/** A photo from the camera, also where a file input can't offer one */
export function CameraDialog({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const video = useRef<HTMLVideoElement | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!element) return;
    video.current = element;
    let isCurrent = true;
    let stream: MediaStream | null = null;
    const devices = (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    const request =
      devices?.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      }) ?? Promise.reject(new Error("no camera"));
    request.then(
      async (granted) => {
        stream = granted;
        if (!isCurrent) {
          for (const track of granted.getTracks()) track.stop();
          return;
        }
        element.srcObject = granted;
        await element.play().catch(() => {});
        setIsReady(true);
      },
      () => {
        if (isCurrent) setHasFailed(true);
      },
    );
    return () => {
      isCurrent = false;
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [element]);

  return (
    <AppDialog
      title={t("editor.photo.take")}
      onClose={onClose}
      confirmText={t("editor.photo.capture")}
      isConfirmDisabled={!isReady}
      onConfirm={() => {
        const source = video.current;
        if (!source) return;
        const canvas = document.createElement("canvas");
        canvas.width = source.videoWidth;
        canvas.height = source.videoHeight;
        canvas.getContext("2d")?.drawImage(source, 0, 0);
        onCapture(canvas.toDataURL("image/jpeg", 0.92));
        onClose();
      }}
    >
      {hasFailed ? (
        <Text tone="danger" role="alert">
          {t("editor.photo.cameraDenied")}
        </Text>
      ) : (
        <video
          ref={setElement}
          playsInline
          muted
          className="w-full rounded-container bg-level-2"
        />
      )}
    </AppDialog>
  );
}
