/**
 * The assistant button's gestures: a tap opens, a drag moves it, and with
 * Smart Log on, holding it still records until it is let go. Sliding far
 * from the button while holding cancels.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";

import {
  clampFab,
  FAB_SIZE,
  readFab,
  saveFab,
  type FabPosition,
} from "./lib/fabPosition";
import { beep, startDictation, type Dictation } from "./lib/speech";
import type { SpeechProblem } from "./lib/speech";

export const HOLD_MS = 700;
const DRAG_PX = 8;
export const CANCEL_PX = 100;

export type Recording = { text: string; willCancel: boolean } | null;

export interface FabOptions {
  canRecord: boolean;
  /** `barcodeBeep`: who muted the scan sound gets no recording tones either */
  shouldBeep: boolean;
  voiceLanguage: string;
  onTap: () => void;
  onRecorded: (text: string) => void;
  onProblem: (problem: SpeechProblem | "nothingHeard") => void;
}

export function useFab(options: FabOptions) {
  const [position, setPosition] = useState<FabPosition>(() =>
    readFab(window.innerWidth, window.innerHeight),
  );
  const [recording, setRecording] = useState<Recording>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const gesture = useRef<{
    x: number;
    y: number;
    start: FabPosition;
    center: { x: number; y: number };
    mode: "press" | "drag" | "record";
    willCancel: boolean;
  } | null>(null);
  /** Removes the window listeners of the gesture under way */
  const release = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dictation = useRef<Dictation | null>(null);
  const tone = (frequency: number) => {
    if (latest.current.shouldBeep) beep(frequency);
  };
  /** The click after a drag or a recording is no tap */
  const shouldSkipClick = useRef(false);

  useEffect(() => {
    const onResize = () => {
      setPosition((old) =>
        clampFab(old, window.innerWidth, window.innerHeight),
      );
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer.current);
      release.current();
      dictation.current?.cancel();
    };
  }, []);

  const startRecording = () => {
    const current = gesture.current;
    if (current?.mode !== "press") return;
    current.mode = "record";
    shouldSkipClick.current = true;
    if ("vibrate" in navigator) navigator.vibrate(30);
    tone(880);
    setRecording({ text: "", willCancel: false });
    let hasProblem = false;
    dictation.current = startDictation({
      language: latest.current.voiceLanguage,
      onText: (text) => {
        setRecording((old) => (old ? { ...old, text } : old));
      },
      onEnd: (text) => {
        dictation.current = null;
        setRecording(null);
        if (text) latest.current.onRecorded(text);
        else if (!hasProblem) latest.current.onProblem("nothingHeard");
      },
      onProblem: (problem) => {
        hasProblem = true;
        dictation.current = null;
        setRecording(null);
        latest.current.onProblem(problem);
      },
    });
    if (!dictation.current) setRecording(null);
  };

  const finish = (isCancelled: boolean) => {
    clearTimeout(timer.current);
    release.current();
    const current = gesture.current;
    gesture.current = null;
    if (current?.mode === "record") {
      tone(440);
      if (isCancelled || current.willCancel) {
        dictation.current?.cancel();
        dictation.current = null;
        setRecording(null);
      } else {
        dictation.current?.stop();
      }
    } else if (current?.mode === "drag") {
      setPosition((now) => {
        saveFab(now);
        return now;
      });
    }
  };

  const move = (clientX: number, clientY: number) => {
    const current = gesture.current;
    if (!current) return;
    const dx = clientX - current.x;
    const dy = clientY - current.y;
    if (current.mode === "record") {
      const willCancel =
        Math.hypot(clientX - current.center.x, clientY - current.center.y) >
        CANCEL_PX;
      if (willCancel !== current.willCancel) {
        current.willCancel = willCancel;
        setRecording((old) => (old ? { ...old, willCancel } : old));
      }
      return;
    }
    if (current.mode === "press" && Math.hypot(dx, dy) < DRAG_PX) return;
    clearTimeout(timer.current);
    current.mode = "drag";
    shouldSkipClick.current = true;
    setPosition(
      clampFab(
        {
          right: current.start.right - dx,
          bottom: current.start.bottom - dy,
        },
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  /**
   * The rest of a gesture is heard on the window: a quick drag leaves the
   * small button at once. (Capturing the pointer instead would send the
   * click of a plain tap past the button.)
   */
  const listen = () => {
    release.current();
    const onMove = (event: globalThis.PointerEvent) => {
      move(event.clientX, event.clientY);
    };
    const onUp = () => {
      finish(false);
    };
    const onCancel = () => {
      finish(true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    release.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  };

  return {
    position,
    recording,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const box = event.currentTarget.getBoundingClientRect();
        shouldSkipClick.current = false;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          start: position,
          center: {
            x: box.left + FAB_SIZE / 2,
            y: box.top + FAB_SIZE / 2,
          },
          mode: "press",
          willCancel: false,
        };
        listen();
        if (latest.current.canRecord) {
          timer.current = setTimeout(startRecording, HOLD_MS);
        }
      },
    },
    onClick: () => {
      if (shouldSkipClick.current) {
        shouldSkipClick.current = false;
        return;
      }
      latest.current.onTap();
    },
  };
}
