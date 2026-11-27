import { useCallback, useEffect, useState } from "react";

export type CameraState = "starting" | "ready" | "unavailable";

/**
 * A camera on a `<video>` while mounted: `deviceId`, else the rear one.
 * `ref` goes on the video; the stream stops when it unmounts. To switch or
 * restart the camera, remount (a `key`).
 */
export function useCamera(deviceId = "") {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [state, setState] = useState<CameraState>("starting");

  useEffect(() => {
    if (!video) return;
    let stream: MediaStream | null = null;
    let isStopped = false;
    const start = async () => {
      try {
        const rear = { video: { facingMode: "environment" } };
        const next = await navigator.mediaDevices
          .getUserMedia(
            deviceId ? { video: { deviceId: { exact: deviceId } } } : rear,
          )
          // A remembered camera that is gone: take the rear one.
          .catch((error: unknown) => {
            if (!deviceId) throw error;
            return navigator.mediaDevices.getUserMedia(rear);
          });
        if (isStopped) {
          for (const track of next.getTracks()) track.stop();
          return;
        }
        stream = next;
        Object.assign(video, { srcObject: next });
        await video.play();
        setState("ready");
      } catch {
        if (!isStopped) setState("unavailable");
      }
    };
    void start();
    return () => {
      isStopped = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
      Object.assign(video, { srcObject: null });
    };
  }, [video, deviceId]);

  /** The current frame as a JPEG */
  const capture = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        if (!video?.videoWidth) {
          resolve(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        canvas.toBlob(resolve, "image/jpeg", 0.85);
      }),
    [video],
  );

  return { ref: setVideo, video, state, capture };
}
