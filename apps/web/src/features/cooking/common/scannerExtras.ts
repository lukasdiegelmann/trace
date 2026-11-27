/** The scanner's torch, beep and camera list (BarcodeScanner.svelte) */

/** The old UI's localStorage key of the chosen camera */
export const CAMERA_KEY = "wl_scanCamId";

export function readCameraId(): string {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeCameraId(id: string): void {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    // Private mode: the choice lasts while the scanner is open.
  }
}

/** A short 1046 Hz tone; silent where audio isn't available */
export function playBeep(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 1046;
    gain.gain.setValueAtTime(0.4, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.15);
    oscillator.onended = () => void context.close();
  } catch {
    // No audio: the scan still counts.
  }
}

/** The video track of what a `<video>` plays */
export function videoTrack(
  video: HTMLVideoElement | null,
): MediaStreamTrack | null {
  const stream = video?.srcObject;
  return typeof MediaStream !== "undefined" && stream instanceof MediaStream
    ? (stream.getVideoTracks().at(0) ?? null)
    : null;
}

export function hasTorch(track: MediaStreamTrack | null): boolean {
  if (!track || typeof track.getCapabilities !== "function") return false;
  return "torch" in track.getCapabilities();
}

export async function setTorch(
  track: MediaStreamTrack,
  isOn: boolean,
): Promise<void> {
  // `torch` isn't in the DOM types yet.
  await track.applyConstraints({
    advanced: [{ torch: isOn } as MediaTrackConstraintSet],
  });
}
