/**
 * Rest timer tone presets, ported from LiftTrace `src/lib/restTones.js`.
 * Synthesised in Web Audio, so there is nothing to bundle.
 */

export interface Beep {
  freq: number;
  ms: number;
  gain: number;
  type?: OscillatorType;
}

export interface FinaleStep extends Beep {
  delayMs: number;
}

export interface RestTone {
  id: string;
  /** The beep at n (3, 2 or 1) seconds remaining, null for silence */
  countdown: (n: number) => Beep | null;
  finale: FinaleStep[];
}

export const REST_TONES: RestTone[] = [
  {
    id: "classic",
    countdown: (n) => ({ freq: 660 + (4 - n) * 120, ms: 120, gain: 0.22 }),
    finale: [
      { freq: 1320, ms: 160, gain: 0.3, delayMs: 0 },
      { freq: 1760, ms: 180, gain: 0.32, delayMs: 200 },
    ],
  },
  {
    id: "bells",
    countdown: (n) => ({
      freq: n === 3 ? 784 : n === 2 ? 880 : 988,
      ms: 220,
      gain: 0.18,
    }),
    finale: [
      { freq: 1047, ms: 260, gain: 0.26, delayMs: 0 },
      { freq: 1319, ms: 260, gain: 0.26, delayMs: 180 },
      { freq: 1568, ms: 340, gain: 0.28, delayMs: 360 },
    ],
  },
  {
    id: "beeper",
    countdown: (n) => ({
      freq: n === 1 ? 1200 : 1000,
      ms: 70,
      gain: 0.2,
      type: "square",
    }),
    finale: [
      { freq: 1400, ms: 90, gain: 0.28, delayMs: 0, type: "square" },
      { freq: 1400, ms: 90, gain: 0.28, delayMs: 140, type: "square" },
      { freq: 1400, ms: 160, gain: 0.3, delayMs: 280, type: "square" },
    ],
  },
  {
    id: "gym",
    countdown: (n) => ({
      freq: 180 + (3 - n) * 25,
      ms: 140,
      gain: 0.28,
      type: "triangle",
    }),
    finale: [
      { freq: 300, ms: 120, gain: 0.32, delayMs: 0, type: "sawtooth" },
      { freq: 450, ms: 140, gain: 0.32, delayMs: 120, type: "sawtooth" },
      { freq: 600, ms: 260, gain: 0.34, delayMs: 260, type: "sawtooth" },
    ],
  },
  {
    id: "minimal",
    countdown: () => null,
    finale: [{ freq: 760, ms: 90, gain: 0.22, delayMs: 0 }],
  },
];

export function getTone(id: string): RestTone {
  return REST_TONES.find((tone) => tone.id === id) ?? REST_TONES[0];
}
