/**
 * Voice input over the browser's Web Speech API, as in the old assistants:
 * no audio leaves for our servers.
 */
export type SpeechProblem = "unsupported" | "denied" | "insecure" | "failed";

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  /* eslint-disable @typescript-eslint/naming-convention -- the Web Speech API */
  continuous: boolean;
  interimResults: boolean;
  /* eslint-enable @typescript-eslint/naming-convention */
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function speechProblem(): SpeechProblem | null {
  if (!window.isSecureContext) return "insecure";
  return recognitionClass() ? null : "unsupported";
}

/** `smartLogVoiceLang`: "auto" follows the browser */
export function voiceLanguage(setting: unknown): string {
  return typeof setting === "string" && setting && setting !== "auto"
    ? setting
    : navigator.language;
}

export function transcriptOf(event: RecognitionResultEvent): string {
  return Array.from(event.results)
    .map((result) => Array.from(result)[0]?.transcript ?? "")
    .join("")
    .trim();
}

export interface Dictation {
  /** Ends listening; what was heard still arrives, then `onEnd` */
  stop: () => void;
  /** Drops what was heard: nothing more is reported */
  cancel: () => void;
}

export function startDictation({
  language,
  onText,
  onEnd,
  onProblem,
}: {
  language: string;
  /** The whole transcript so far, interim words included */
  onText: (text: string) => void;
  /** With everything heard, once listening has ended */
  onEnd: (text: string) => void;
  onProblem: (problem: SpeechProblem) => void;
}): Dictation | null {
  const problem = speechProblem();
  const Recognizer = recognitionClass();
  if (problem || !Recognizer) {
    onProblem(problem ?? "unsupported");
    return null;
  }
  const recognition = new Recognizer();
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = true;
  let heard = "";
  recognition.onresult = (event) => {
    heard = transcriptOf(event);
    onText(heard);
  };
  recognition.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") return;
    onProblem(
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "denied"
        : "failed",
    );
  };
  recognition.onend = () => {
    onEnd(heard);
  };
  try {
    recognition.start();
  } catch {
    onProblem("failed");
    return null;
  }
  return {
    stop: () => {
      recognition.stop();
    },
    cancel: () => {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.abort();
    },
  };
}

let audio: AudioContext | null = null;

/** The short tones when recording starts and stops */
export function beep(frequency: number, milliseconds = 90): void {
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.frequency.value = frequency;
    const now = audio.currentTime;
    volume.gain.setValueAtTime(0.15, now);
    volume.gain.linearRampToValueAtTime(0, now + milliseconds / 1000);
    oscillator.connect(volume);
    volume.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + milliseconds / 1000 + 0.02);
  } catch {
    // No audio: recording works without its tone.
  }
}
