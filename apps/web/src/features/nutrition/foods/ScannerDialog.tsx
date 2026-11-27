import {
  Box,
  Button,
  InplaceMultiSelect,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Flashlight, FlashlightOff, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import { normalizeScannedBarcode } from "../lib/barcode";
import { useNtSettings } from "../settings";
import {
  beep,
  hasTorch,
  SCAN_ENGINE_NAMES,
  SCAN_ENGINES,
  setTorch,
  startScanner,
  type ScanEngine,
  type StopScanner,
} from "./scannerEngines";

/** The old UI's keys, so both remember the same choice */
const ENGINE_KEY = "wl_scanEngine";
const CAMERA_KEY = "wl_scanCamId";

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // blocked storage: chosen again next time
  }
}

/** `mediaDevices` is missing outside secure contexts, whatever its type says */
function hasCamera(): boolean {
  const devices = (navigator as { mediaDevices?: Partial<MediaDevices> })
    .mediaDevices;
  return typeof devices?.getUserMedia === "function";
}

type Status =
  | { kind: "starting" | "scanning" | "noCamera" | "denied" }
  | { kind: "failed"; message: string };

export function ScannerDialog({
  onCode,
  onClose,
}: {
  /** The code read or typed, once */
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const [engine, setEngine] = useState<ScanEngine>(() => {
    const stored = read(ENGINE_KEY) as ScanEngine;
    return SCAN_ENGINES.includes(stored) ? stored : "zxing";
  });
  const [camera, setCamera] = useState(() => read(CAMERA_KEY));
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [status, setStatus] = useState<Status>(() =>
    hasCamera() ? { kind: "starting" } : { kind: "noCamera" },
  );
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorchState] = useState({ isAvailable: false, isOn: false });
  const [manual, setManual] = useState("");
  // The container the engines draw into; set by the ref callback
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const isDone = useRef(false);

  const finish = (code: string) => {
    const normalized = normalizeScannedBarcode(code);
    if (!normalized || isDone.current) return;
    isDone.current = true;
    if (settings.barcodeBeep) beep();
    onCode(normalized);
  };
  const latestFinish = useRef(finish);
  useEffect(() => {
    latestFinish.current = finish;
  });

  const shouldLightUp = settings.barcodeFlashlight;
  useEffect(() => {
    if (!container) return;
    if (!hasCamera()) return;
    let isCurrent = true;
    let stop: StopScanner | null = null;
    let torchTimer: ReturnType<typeof setTimeout> | undefined;
    startScanner(engine, container, camera, (code) => {
      latestFinish.current(code);
    }).then(
      (stopScanner) => {
        if (!isCurrent) {
          stopScanner();
          return;
        }
        stop = stopScanner;
        setStatus({ kind: "scanning" });
        // Labels are only there once the camera was allowed
        void navigator.mediaDevices.enumerateDevices().then((devices) => {
          if (isCurrent) {
            setCameras(devices.filter((d) => d.kind === "videoinput"));
          }
        });
        // Some engines attach the stream a moment later
        torchTimer = setTimeout(() => {
          if (!hasTorch(container)) return;
          setTorchState({ isAvailable: true, isOn: shouldLightUp });
          if (shouldLightUp) void setTorch(container, true).catch(() => {});
        }, 800);
      },
      (caught: unknown) => {
        if (!isCurrent) return;
        const name = caught instanceof Error ? caught.name : "";
        setStatus(
          name === "NotAllowedError"
            ? { kind: "denied" }
            : name === "NotFoundError"
              ? { kind: "noCamera" }
              : {
                  kind: "failed",
                  message:
                    caught instanceof Error ? caught.message : String(caught),
                },
        );
      },
    );
    return () => {
      isCurrent = false;
      clearTimeout(torchTimer);
      stop?.();
    };
  }, [container, engine, camera, attempt, shouldLightUp]);

  const restart = () => {
    isDone.current = false;
    setStatus({ kind: "starting" });
    setTorchState({ isAvailable: false, isOn: false });
    setAttempt((count) => count + 1);
  };

  const statusText =
    status.kind === "failed"
      ? t("foods.scanner.failed", { message: status.message })
      : status.kind === "scanning"
        ? t("foods.scanner.hint")
        : t(`foods.scanner.${status.kind}`);

  return (
    <AppDialog title={t("foods.scanner.title")} onClose={onClose}>
      <Stack gap={3}>
        <Row gap={2} shouldWrap>
          <InplaceMultiSelect
            formField
            label={t("foods.scanner.engine")}
            value={engine}
            onChange={(value) => {
              setEngine(value as ScanEngine);
              remember(ENGINE_KEY, value);
              restart();
            }}
            options={SCAN_ENGINES.map((id) => ({
              value: id,
              label: SCAN_ENGINE_NAMES[id],
            }))}
          />
          {cameras.length > 1 && (
            <InplaceMultiSelect
              formField
              label={t("foods.scanner.camera")}
              value={camera}
              onChange={(value) => {
                setCamera(value);
                remember(CAMERA_KEY, value);
                restart();
              }}
              options={cameras.map((device, index) => ({
                value: device.deviceId,
                label: device.label || `${index + 1}`,
              }))}
            />
          )}
        </Row>
        <Box surface="surface" radius="lg" isClipped position="relative">
          <div className="relative aspect-4/3 w-full">
            <div
              ref={setContainer}
              role="img"
              aria-label={t("foods.scanner.videoLabel")}
              className="absolute inset-0"
            />
            <div className="pointer-events-none absolute inset-x-[12%] inset-y-[30%] rounded-container border-2 border-accent" />
          </div>
        </Box>
        <Text
          variant="small"
          tone={
            status.kind === "scanning" || status.kind === "starting"
              ? "muted"
              : "danger"
          }
          role="status"
        >
          {statusText}
        </Text>
        <Row gap={2}>
          <Button
            size="sm"
            variant="secondary"
            text={t("foods.scanner.refresh")}
            onClick={restart}
          >
            <RotateCw aria-hidden size={14} />
          </Button>
          {torch.isAvailable && (
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={torch.isOn}
              text={t(
                torch.isOn ? "foods.scanner.torchOff" : "foods.scanner.torchOn",
              )}
              onClick={() => {
                if (!container) return;
                const isOn = !torch.isOn;
                setTorchState({ ...torch, isOn });
                void setTorch(container, isOn).catch(() => {});
              }}
            >
              {torch.isOn ? (
                <FlashlightOff aria-hidden size={14} />
              ) : (
                <Flashlight aria-hidden size={14} />
              )}
            </Button>
          )}
        </Row>
        <Row gap={2} align="end">
          <div className="min-w-0 flex-1">
            <Input
              label={t("foods.scanner.manual")}
              inputMode="numeric"
              value={manual}
              onValueChange={setManual}
              onEnter={() => {
                finish(manual);
              }}
              fieldSize="lg"
            />
          </div>
          <Button
            size="lg"
            variant="primary"
            text={t("foods.scanner.lookUp")}
            isDisabled={!manual.trim()}
            onClick={() => {
              finish(manual);
            }}
          />
        </Row>
      </Stack>
    </AppDialog>
  );
}
