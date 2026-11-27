/**
 * The settings screen's preview of a rest tone (LiftTrace's
 * src/stores/restTimer.js); the tones themselves are in @/lib/restTones.
 */
import { getTone, type Beep, type FinaleStep } from "@/lib/restTones";

/** The preview: a taste of the countdown, then the finale, with delays */
export function previewSteps(id: string): FinaleStep[] {
  const tone = getTone(id);
  const steps: FinaleStep[] = [];
  let delay = 0;
  for (const secondsLeft of [3, 1]) {
    const cue = tone.countdown(secondsLeft);
    if (cue) {
      steps.push({ ...cue, delayMs: delay });
      delay += 200;
    }
  }
  return steps.concat(
    tone.finale.map((step) => ({ ...step, delayMs: delay + step.delayMs })),
  );
}

let context: AudioContext | null = null;

function play({ freq, ms, gain, type = "sine" }: Beep): void {
  try {
    context ??= new AudioContext();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    const now = context.currentTime;
    volume.gain.setValueAtTime(0, now);
    volume.gain.linearRampToValueAtTime(gain, now + 0.015);
    volume.gain.linearRampToValueAtTime(0, now + ms / 1000);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + ms / 1000 + 0.02);
  } catch {
    // No audio on this device: the preview stays silent.
  }
}

export function previewRestTone(id: string): void {
  for (const step of previewSteps(id)) {
    setTimeout(() => {
      play(step);
    }, step.delayMs);
  }
}
