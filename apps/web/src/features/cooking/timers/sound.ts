/** The timer's beeps and vibration (cooktrace/src/stores/cookTimers.js) */
let context: AudioContext | null = null;

/** iOS only plays after the context was resumed by a user gesture */
export function prepareAudio(): AudioContext | null {
  try {
    if (!context && typeof AudioContext !== "undefined") {
      context = new AudioContext();
    }
    if (context?.state === "suspended") void context.resume();
  } catch {
    // no sound: the notification and the screen still tell
  }
  return context;
}

function tone(
  audio: AudioContext,
  type: OscillatorType,
  frequency: number,
  volume: number,
  offset: number,
): void {
  const start = audio.currentTime + offset;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
  oscillator.start(start);
  oscillator.stop(start + 0.14);
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // not allowed here
  }
}

/** At 3, 2 and 1 seconds left */
export function playWarning(): void {
  const audio = prepareAudio();
  if (audio) tone(audio, "sine", 880, 0.22, 0);
  vibrate(140);
}

/** One ring of the alarm: two short bursts */
export function playRing(): void {
  const audio = prepareAudio();
  if (!audio) return;
  tone(audio, "square", 950, 0.18, 0);
  tone(audio, "square", 950, 0.18, 0.18);
}
