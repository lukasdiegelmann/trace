/**
 * An in-memory log for bug reports, ported from the old UIs'
 * src/lib/log-capture.js (web part): console output and uncaught errors in a
 * ring buffer that Settings > Diagnostics shows. Nothing leaves the device.
 */
const MAX_LINES = 500;
const MAX_LINES_VERBOSE = 1000;
export const VERBOSE_STORAGE_KEY = "trace.verboseLogging";
const LEVELS = ["log", "info", "warn", "error", "debug"] as const;

const buffer: string[] = [];
let isInstalled = false;
let isVerbose = readVerbose();

function readVerbose(): boolean {
  try {
    return window.localStorage.getItem(VERBOSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

export function pushLogLine(level: string, args: unknown[]): void {
  const time = new Date().toISOString().slice(11, 23);
  buffer.push(
    `[${time}] [${level.toUpperCase()}] ${args.map(stringify).join(" ")}`,
  );
  const cap = isVerbose ? MAX_LINES_VERBOSE : MAX_LINES;
  if (buffer.length > cap) buffer.splice(0, buffer.length - cap);
}

/** Wraps the console once; what it printed still reaches the dev tools */
export function installLogCapture(): void {
  if (isInstalled) return;
  isInstalled = true;
  for (const level of LEVELS) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushLogLine(level, args);
      original(...args);
    };
  }
  window.addEventListener("error", (event) => {
    pushLogLine("error", [
      "[uncaught]",
      event.message,
      "at",
      `${event.filename}:${event.lineno}`,
    ]);
  });
  window.addEventListener("unhandledrejection", (event) => {
    pushLogLine("error", ["[unhandled rejection]", event.reason]);
  });
}

/** The log with a header that says what it came from */
export function logText(): string {
  return [
    `Trace web · ${new Date().toISOString()}`,
    `User agent: ${navigator.userAgent}`,
    "─".repeat(60),
    ...buffer,
  ].join("\n");
}

export function logLineCount(): number {
  return buffer.length;
}

export function clearLog(): void {
  buffer.length = 0;
}

export function isVerboseLogging(): boolean {
  return isVerbose;
}

export function setVerboseLogging(isOn: boolean): void {
  isVerbose = isOn;
  try {
    if (isOn) window.localStorage.setItem(VERBOSE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(VERBOSE_STORAGE_KEY);
  } catch {
    // Private mode: for this page only.
  }
}
