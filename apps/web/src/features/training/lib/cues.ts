/**
 * Sound and vibration cues of the rest and hold timers (LiftTrace
 * `stores/restTimer.js`, web paths): Web Audio beeps and `navigator.vibrate`,
 * silent while the page is hidden.
 */
import { getTone, type Beep } from "@/lib/restTones";

export interface CuePrefs {
  hasTone: boolean;
  hasVibration: boolean;
  toneId: string;
}

let audio: AudioContext | null = null;

function isHidden(): boolean {
  return document.visibilityState === "hidden";
}

function beep({ freq, ms, gain, type = "sine" }: Beep): void {
  try {
    if (isHidden() || typeof AudioContext === "undefined") return;
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    const now = audio.currentTime;
    volume.gain.setValueAtTime(0, now);
    volume.gain.linearRampToValueAtTime(gain, now + 0.015);
    volume.gain.linearRampToValueAtTime(0, now + ms / 1000);
    oscillator.connect(volume);
    volume.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + ms / 1000 + 0.02);
  } catch {
    // No audio: the cue is just silent
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // No vibration motor
  }
}

function finale(toneId: string): void {
  for (const step of getTone(toneId).finale) {
    setTimeout(() => {
      beep(step);
    }, step.delayMs);
  }
}

/** The beep at n = 3, 2, 1 */
export function playCountdown(n: number, prefs: CuePrefs): void {
  if (isHidden()) return;
  if (prefs.hasTone) {
    const cue = getTone(prefs.toneId).countdown(n);
    if (cue) beep(cue);
  }
  if (prefs.hasVibration) vibrate(40);
}

/** The end of a rest, or the start/target of a hold */
export function playFinale(prefs: CuePrefs, pattern: number[]): void {
  if (isHidden()) return;
  if (prefs.hasTone) finale(prefs.toneId);
  if (prefs.hasVibration) vibrate(pattern);
}
