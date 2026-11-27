import { useEffect, useRef } from "react";

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "code_128",
  "code_39",
  "qr_code",
];
const INTERVAL_MS = 250;

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type DetectorClass = new (options: { formats: string[] }) => Detector;

/**
 * Reads barcodes from a playing video: the browser's BarcodeDetector where
 * there is one, else zxing, loaded only then (decision in issue #6).
 * Calls `onCode` once.
 */
export function useBarcodeDecoder(
  video: HTMLVideoElement | null,
  isActive: boolean,
  onCode: (code: string) => void,
): void {
  const callback = useRef(onCode);
  useEffect(() => {
    callback.current = onCode;
  });

  useEffect(() => {
    if (!video || !isActive) return;
    // An object, so the async steps below see a later stop.
    const run = { isStopped: false };
    const hasStopped = () => run.isStopped;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopZxing: (() => void) | undefined;
    const found = (code: string) => {
      if (run.isStopped || !code.trim()) return;
      run.isStopped = true;
      if ("vibrate" in navigator) navigator.vibrate(60);
      callback.current(code.trim());
    };

    const NativeDetector = (window as { BarcodeDetector?: DetectorClass })
      .BarcodeDetector;
    if (NativeDetector) {
      const detector = new NativeDetector({ formats: FORMATS });
      const tick = async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) found(codes[0].rawValue);
        } catch {
          // A frame that can't be read: try the next one.
        }
        if (!hasStopped()) timer = setTimeout(() => void tick(), INTERVAL_MS);
      };
      void tick();
    } else {
      const start = async () => {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (hasStopped()) return;
        const reader = new BrowserMultiFormatReader();
        // Decodes from the element useCamera already plays.
        const controls = await reader.decodeFromVideoElement(
          video,
          (result) => {
            if (result) found(result.getText());
          },
        );
        stopZxing = () => {
          controls.stop();
        };
        if (hasStopped()) stopZxing();
      };
      void start();
    }

    return () => {
      run.isStopped = true;
      clearTimeout(timer);
      stopZxing?.();
    };
  }, [video, isActive]);
}
