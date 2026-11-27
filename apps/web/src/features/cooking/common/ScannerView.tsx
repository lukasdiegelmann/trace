import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { Flashlight, FlashlightOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/shared/settings";

import { hasTorch, playBeep, setTorch, videoTrack } from "./scannerExtras";
import { useBarcodeDecoder } from "./useBarcodeDecoder";
import { useCamera } from "./useCamera";

/**
 * The live picture that decodes, with the torch where the camera has one.
 * Remounted (by `key`) to switch or restart the camera.
 */
export function ScannerView({
  cameraId,
  onScan,
  onReady,
}: {
  cameraId: string;
  onScan: (code: string) => void;
  /** The camera plays: its labels can be listed now */
  onReady: (playingId: string) => void;
}) {
  const { t } = useTranslation("cooking");
  const { values: settings } = useSettings("ct");
  const { ref, video, state } = useCamera(cameraId);
  /** Null: as `barcodeFlashlight` says */
  const [isLit, setIsLit] = useState<boolean | null>(null);
  const track = state === "ready" ? videoTrack(video) : null;
  const canLight = hasTorch(track);
  const isTorchOn = canLight && (isLit ?? settings.barcodeFlashlight);

  useBarcodeDecoder(video, state === "ready", (code) => {
    if (settings.barcodeBeep) playBeep();
    onScan(code);
  });

  useEffect(() => {
    if (state !== "ready") return;
    onReady(videoTrack(video)?.getSettings().deviceId ?? "");
  }, [state, video, onReady]);

  useEffect(() => {
    if (state !== "ready") return;
    const current = videoTrack(video);
    if (!current || !hasTorch(current)) return;
    void setTorch(current, isTorchOn).catch(() => {
      // Some cameras report a torch they can't switch.
    });
  }, [state, video, isTorchOn]);

  return (
    <Stack gap={2}>
      <video
        ref={ref}
        muted
        playsInline
        className="max-h-72 w-full rounded-container bg-level-1 object-cover"
      />
      <Row justify="between" align="center" gap={2}>
        <Text
          variant="small"
          tone={state === "unavailable" ? "danger" : "muted"}
        >
          {state === "unavailable"
            ? t("cookingCommon.barcode.noCamera")
            : t("cookingCommon.barcode.hint")}
        </Text>
        {canLight ? (
          <Button
            size="sm"
            variant={isTorchOn ? "primary" : "secondary"}
            aria-pressed={isTorchOn}
            text={t(
              isTorchOn
                ? "cookingCommon.barcode.torchOn"
                : "cookingCommon.barcode.torchOff",
            )}
            onClick={() => {
              setIsLit(!isTorchOn);
            }}
          >
            {isTorchOn ? (
              <Flashlight aria-hidden size={14} />
            ) : (
              <FlashlightOff aria-hidden size={14} />
            )}
          </Button>
        ) : null}
      </Row>
    </Stack>
  );
}
