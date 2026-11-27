/**
 * The 1080×1350 PNG of a finished workout, ported from LiftTrace
 * `src/lib/workoutCard.js`, with its texts passed in. The colours are the
 * image's own (it looks the same in both themes); only the accent follows
 * the app's.
 */
import { downloadBlob } from "./workoutCsv";
import { fmtSetLabel, isTimedSet } from "./workout";
import type { WorkoutExercise, WorkoutLog, WorkoutSet } from "./workoutTypes";
import {
  fmtSummaryDuration,
  fmtVolume,
  groupCompletedExercises,
  summaryStats,
} from "./workoutSummary";

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 64;
const ROW = 60;
const IMAGE = {
  background: "#0A0B0F",
  surface: "#16181E",
  line: "#23262E",
  text: "#F5F6F8",
  muted: "#A8AFBD",
  faint: "#6B7280",
  star: "#FFD54F",
  accent: "#FF7433",
};
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface ShareCardTexts {
  complete: string;
  workout: string;
  volume: string;
  sets: string;
  exercises: string;
  duration: string;
  superset: string;
  topSet: (count: number, top: string) => string;
  more: (count: number) => string;
  date: string;
}

/** The headline set: heaviest, or the longest hold when timed */
export function topSet(exercise: WorkoutExercise): WorkoutSet | undefined {
  const completed = (exercise.sets ?? []).filter((s) => s.completed);
  const isTimed = completed.some((s) => isTimedSet(exercise, s));
  const rank = (s: WorkoutSet): [number, number] =>
    isTimed
      ? [s.duration_sec ?? 0, s.weight ?? 0]
      : [s.weight ?? 0, s.reps ?? 0];
  return completed.reduce<WorkoutSet | undefined>((best, set) => {
    if (!best) return set;
    const [a, b] = rank(set);
    const [x, y] = rank(best);
    return a > x || (a === x && b > y) ? set : best;
  }, undefined);
}

function accentColor(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-accent")
    .trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : IMAGE.accent;
}

function draw(
  context: CanvasRenderingContext2D,
  workout: WorkoutLog,
  texts: ShareCardTexts,
) {
  const accent = accentColor();
  const write = (
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = "left",
  ) => {
    context.font = font;
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(text, x, y);
  };
  const line = (y: number) => {
    context.strokeStyle = IMAGE.line;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(MARGIN, y);
    context.lineTo(WIDTH - MARGIN, y);
    context.stroke();
  };

  context.fillStyle = IMAGE.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = context.createRadialGradient(
    WIDTH - 100,
    -100,
    50,
    WIDTH - 100,
    -100,
    700,
  );
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  write("LIFTTRACE", MARGIN, 96, `700 32px ${SANS}`, accent);
  write(
    `★ ${texts.complete.toUpperCase()}`,
    WIDTH - MARGIN,
    96,
    `700 32px ${SANS}`,
    IMAGE.star,
    "right",
  );
  write(
    (workout.name || texts.workout).slice(0, 28),
    MARGIN,
    220,
    `800 76px ${SANS}`,
    IMAGE.text,
  );
  write(texts.date, MARGIN, 268, `500 28px ${SANS}`, IMAGE.muted);

  const stats = summaryStats(workout);
  const tiles = [
    [texts.volume, fmtVolume(stats.volume)],
    [texts.sets, String(stats.sets)],
    [texts.exercises, String(stats.exercises)],
    [texts.duration, fmtSummaryDuration(workout.duration_min)],
  ] as const;
  const tileWidth = (WIDTH - MARGIN * 2 - 16 * 3) / 4;
  tiles.forEach(([label, value], i) => {
    const x = MARGIN + i * (tileWidth + 16);
    context.fillStyle = IMAGE.surface;
    context.beginPath();
    context.roundRect(x, 320, tileWidth, 140, 18);
    context.fill();
    const center = x + tileWidth / 2;
    write(value, center, 390, `800 48px ${SANS}`, IMAGE.text, "center");
    write(
      label.toUpperCase(),
      center,
      428,
      `600 18px ${SANS}`,
      IMAGE.faint,
      "center",
    );
  });

  let y = 520;
  const maxY = HEIGHT - 120;
  let drawn = 0;
  const row = (exercise: WorkoutExercise, indent: number) => {
    const completed = (exercise.sets ?? []).filter((s) => s.completed);
    const top = fmtSetLabel(exercise, topSet(exercise));
    write(
      (exercise.exercise_name ?? "").slice(0, 28),
      MARGIN + indent,
      y,
      `600 32px ${SANS}`,
      IMAGE.text,
    );
    write(
      completed.length === 1 ? top : texts.topSet(completed.length, top),
      WIDTH - MARGIN,
      y,
      '500 28px ui-monospace, "SF Mono", Menlo, monospace',
      IMAGE.muted,
      "right",
    );
    y += ROW;
    drawn++;
  };

  const groups = groupCompletedExercises(workout.exercises);
  for (const group of groups) {
    if (y > maxY - ROW) break;
    if (group.kind === "single") {
      const start = y;
      row(group.exercise, 0);
      line(start + 18);
      continue;
    }
    const start = y;
    write(texts.superset.toUpperCase(), 80, y - 22, `800 18px ${SANS}`, accent);
    for (const member of group.members) {
      if (y > maxY - ROW) break;
      row(member, 16);
    }
    context.fillStyle = accent;
    context.fillRect(MARGIN, start - 34, 4, y - ROW + 12 - (start - 34));
    line(y - ROW + 22);
    y += 10;
  }
  const total = groups.reduce(
    (sum, g) => sum + (g.kind === "single" ? 1 : g.members.length),
    0,
  );
  if (total > drawn && y <= maxY) {
    write(
      texts.more(total - drawn),
      MARGIN,
      y,
      `500 24px ${SANS}`,
      IMAGE.faint,
    );
  }
  write(
    "lifttrace",
    WIDTH / 2,
    HEIGHT - 50,
    `600 22px ${SANS}`,
    IMAGE.faint,
    "center",
  );
}

export function shareCardFilename(workout: WorkoutLog): string {
  const name = (workout.name || "workout").replace(/\s+/g, "-").toLowerCase();
  return `lifttrace-${name}-${workout.date || "today"}.png`;
}

export async function renderShareCard(
  workout: WorkoutLog,
  texts: ShareCardTexts,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  draw(context, workout, texts);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas"));
      },
      "image/png",
      0.95,
    );
  });
}

/** The share sheet with the image, or a download where there is none */
export async function shareWorkoutCard(
  workout: WorkoutLog,
  texts: ShareCardTexts,
  share: { title: string; text: string },
): Promise<void> {
  const blob = await renderShareCard(workout, texts);
  const filename = shareCardFilename(workout);
  const file = new File([blob], filename, { type: "image/png" });
  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: share.title,
        text: workout.name || share.text,
      });
      return;
    } catch (error) {
      // Cancelled by the user: done. Anything else falls back to download.
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}
