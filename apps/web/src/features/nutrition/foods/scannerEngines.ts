/**
 * The three barcode engines of the old UI (BarcodeScanner.svelte), each
 * loaded only when chosen: a phone one of them can't read may work with
 * another. All of them show the camera in a <video> inside `container`.
 */

export const SCAN_ENGINES = ["zxing", "html5qr", "quagga2"] as const;
export type ScanEngine = (typeof SCAN_ENGINES)[number];

export const SCAN_ENGINE_NAMES: Record<ScanEngine, string> = {
  zxing: "@zxing/library",
  html5qr: "html5-qrcode",
  quagga2: "quagga2",
};

/** Stops the camera and the decoding */
export type StopScanner = () => void;

type OnCode = (code: string) => void;

function stopTracks(container: HTMLElement) {
  for (const video of container.querySelectorAll("video")) {
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop();
    }
  }
}

async function startZxing(
  container: HTMLElement,
  deviceId: string,
  onCode: OnCode,
): Promise<StopScanner> {
  const { BrowserMultiFormatReader } = await import("@zxing/library");
  const video = document.createElement("video");
  video.className = "absolute inset-0 size-full object-cover";
  video.setAttribute("playsinline", "");
  video.muted = true;
  container.replaceChildren(video);
  const stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: "environment" },
  });
  const reader = new BrowserMultiFormatReader();
  // Frames without a code call back too, with no result
  void reader.decodeFromStream(stream, video, (result: unknown) => {
    const found = result as { getText: () => string } | null;
    if (found) onCode(found.getText());
  });
  return () => {
    reader.reset();
    for (const track of stream.getTracks()) track.stop();
    container.replaceChildren();
  };
}

async function startHtml5(
  container: HTMLElement,
  deviceId: string,
  onCode: OnCode,
): Promise<StopScanner> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const inner = document.createElement("div");
  inner.id = `trace-scan-${Date.now()}`;
  inner.className =
    "absolute inset-0 [&_video]:size-full [&_video]:object-cover";
  container.replaceChildren(inner);
  const reader = new Html5Qrcode(inner.id);
  await reader.start(
    deviceId || { facingMode: "environment" },
    { fps: 10 },
    onCode,
    () => {},
  );
  return () => {
    void reader
      .stop()
      .catch(() => {})
      .finally(() => {
        stopTracks(inner);
        inner.remove();
      });
  };
}

async function startQuagga(
  container: HTMLElement,
  deviceId: string,
  onCode: OnCode,
): Promise<StopScanner> {
  const { default: Quagga } = await import("@ericblade/quagga2");
  const target = document.createElement("div");
  target.className =
    "absolute inset-0 [&_canvas]:hidden [&_video]:size-full [&_video]:object-cover";
  container.replaceChildren(target);
  await Quagga.init({
    inputStream: {
      type: "LiveStream",
      target,
      constraints: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "environment" },
    },
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "upc_reader",
        "upc_e_reader",
        "code_128_reader",
        "code_39_reader",
      ],
    },
    locate: true,
  });
  Quagga.start();
  const detected = (result: { codeResult?: { code?: string | null } }) => {
    const code = result.codeResult?.code;
    if (code) onCode(code);
  };
  Quagga.onDetected(detected);
  return () => {
    Quagga.offDetected(detected);
    void Quagga.stop();
    stopTracks(target);
    target.remove();
  };
}

export function startScanner(
  engine: ScanEngine,
  container: HTMLElement,
  deviceId: string,
  onCode: OnCode,
): Promise<StopScanner> {
  if (engine === "html5qr") return startHtml5(container, deviceId, onCode);
  if (engine === "quagga2") return startQuagga(container, deviceId, onCode);
  return startZxing(container, deviceId, onCode);
}

interface TorchCapabilities {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the browser's name
  torch?: boolean;
}

function videoTrack(container: HTMLElement): MediaStreamTrack | null {
  const stream = container.querySelector("video")?.srcObject;
  return stream instanceof MediaStream
    ? (stream.getVideoTracks()[0] ?? null)
    : null;
}

export function hasTorch(container: HTMLElement): boolean {
  const track = videoTrack(container);
  if (!track || typeof track.getCapabilities !== "function") return false;
  return Boolean((track.getCapabilities() as TorchCapabilities).torch);
}

export async function setTorch(
  container: HTMLElement,
  isOn: boolean,
): Promise<void> {
  await videoTrack(container)?.applyConstraints({
    advanced: [{ torch: isOn } as MediaTrackConstraintSet],
  });
}

/** The short tone of a successful scan (`barcodeBeep`) */
export function beep(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 1046;
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
    oscillator.onended = () => void context.close();
  } catch {
    // no audio: the scan itself still counts
  }
}
