import {
  Button,
  Dialog,
  InplaceMultiSelect,
  Input,
  Row,
  Stack,
} from "@monocircuit/monolithium/components";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { readCameraId, writeCameraId } from "./scannerExtras";
import { ScannerView } from "./ScannerView";

export interface BarcodeScannerProps {
  onClose: () => void;
  onScan: (code: string) => void;
}

interface Camera {
  id: string;
  label: string;
}

/**
 * Scans with a chosen camera, or takes the number typed. Mounted while open.
 * The decoder picks its own library (the old UI's library choice is gone).
 * TODO(monolithium): a barcode scanner
 */
export function BarcodeScanner({ onClose, onScan }: BarcodeScannerProps) {
  const { t } = useTranslation("cooking");
  const [cameraId, setCameraId] = useState(readCameraId);
  const [playingId, setPlayingId] = useState("");
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState("");

  const listCameras = useCallback((playing: string) => {
    setPlayingId(playing);
    // Labels are only filled in once the camera is allowed.
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      setCameras(
        devices
          .filter((device) => device.kind === "videoinput" && device.deviceId)
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `#${index + 1}`,
          })),
      );
    });
  }, []);

  const submit = () => {
    if (typed.trim()) onScan(typed.trim());
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("cookingCommon.barcode.title")}
      cancelText={t("cookingCommon.cancel")}
    >
      <Stack gap={3}>
        <ScannerView
          key={`${cameraId}:${attempt}`}
          cameraId={cameraId}
          onScan={onScan}
          onReady={listCameras}
        />
        <Row gap={2} align="end" shouldWrap>
          {cameras.length > 1 ? (
            <InplaceMultiSelect
              label={t("cookingCommon.barcode.camera")}
              value={cameraId || playingId}
              options={cameras.map((camera) => ({
                value: camera.id,
                label: camera.label,
              }))}
              onChange={(id) => {
                writeCameraId(id);
                setCameraId(id);
              }}
            />
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            text={t("cookingCommon.barcode.restart")}
            onClick={() => {
              setAttempt((count) => count + 1);
            }}
          >
            <RefreshCw aria-hidden size={14} />
          </Button>
        </Row>
        <Row gap={2} align="end">
          <Input
            label={t("cookingCommon.barcode.manual")}
            value={typed}
            inputMode="numeric"
            wrapperClassName="min-w-0 flex-1"
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            onEnter={submit}
          />
          <Button
            variant="primary"
            size="md"
            text={t("cookingCommon.barcode.use")}
            isDisabled={!typed.trim()}
            onClick={submit}
          />
        </Row>
      </Stack>
    </Dialog>
  );
}
