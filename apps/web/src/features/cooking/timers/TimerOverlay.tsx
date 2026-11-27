import {
  Button,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { GripVertical, Plus, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { readJson, writeJson } from "./store";
import {
  addOneMinute,
  dismissTimer,
  ensureTicker,
  formatRemaining,
  timerStore,
  type CookTimer,
} from "./timers";

const POSITION_KEY = "ct:timer-rail-pos";
const MARGIN = 8;

interface Position {
  x: number;
  y: number;
}

function readPosition(): Position | null {
  const stored = readJson(POSITION_KEY) as Partial<Position> | null;
  return stored && typeof stored.x === "number" && typeof stored.y === "number"
    ? { x: stored.x, y: stored.y }
    : null;
}

/** Keeps the panel on the screen */
function clamp(position: Position, element: HTMLElement): Position {
  const limit = (value: number, max: number) =>
    Math.min(Math.max(value, MARGIN), Math.max(MARGIN, max - MARGIN));
  return {
    x: limit(position.x, window.innerWidth - element.offsetWidth),
    y: limit(position.y, window.innerHeight - element.offsetHeight),
  };
}

/** Scrolls to a step of the recipe on screen and lights it up */
function flashStep(index: number): boolean {
  const element = document.getElementById(`step-${index}`);
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add("bg-accent/20");
  setTimeout(() => {
    element.classList.remove("bg-accent/20");
  }, 1400);
  return true;
}

function TimerRow({ timer, now }: { timer: CookTimer; now: number }) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const remaining = timer.endsAt - now;
  const progress = 1 - Math.max(0, remaining) / (timer.durationSec * 1000);
  const recipePath =
    timer.recipeId === null ? null : `/cooking/recipes/${timer.recipeId}`;

  const jump = () => {
    if (recipePath && pathname !== recipePath) void navigate(recipePath);
    else if (timer.stepIndex !== null) flashStep(timer.stepIndex);
  };

  return (
    <Stack gap={1} padding={2}>
      <Row gap={2} align="center" justify="between">
        <Stack gap={0} canShrink>
          {timer.recipeName ? (
            <Text variant="caption" tone="muted" isTruncated>
              {timer.recipeName}
            </Text>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            text={
              timer.stepIndex === null
                ? timer.label
                : `${t("timers.step", { number: timer.stepIndex + 1 })} · ${timer.label}`
            }
            onClick={jump}
          />
        </Stack>
        {timer.done ? (
          <Button
            variant="primary"
            size="sm"
            text={t("timers.done")}
            onClick={() => {
              dismissTimer(timer.id);
            }}
          />
        ) : (
          <Text variant="mono" role="timer">
            {formatRemaining(remaining)}
          </Text>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label={timer.done ? t("timers.snooze") : t("timers.addMinute")}
          onClick={() => {
            addOneMinute(timer.id);
          }}
        >
          <Plus aria-hidden size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("timers.dismiss")}
          onClick={() => {
            dismissTimer(timer.id);
          }}
        >
          <X aria-hidden size={16} />
        </Button>
      </Row>
      <ProgressBar value={progress} label={timer.label} />
    </Stack>
  );
}

/** Every running timer, floating above the app; the head drags it */
export function TimerOverlay() {
  const { t } = useTranslation("cooking");
  const timers = useSyncExternalStore(timerStore.subscribe, timerStore.get);
  const [position, setPosition] = useState(readPosition);
  // The store emits on every tick; that is when the shown time moves.
  const [now, setNow] = useState(() => Date.now());
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<Position | null>(null);

  useEffect(() => {
    ensureTicker();
    return timerStore.subscribe(() => {
      setNow(Date.now());
    });
  }, []);

  if (timers.length === 0) return null;

  const start = (event: PointerEvent<HTMLDivElement>) => {
    const box = panel.current?.getBoundingClientRect();
    if (!box) return;
    drag.current = { x: event.clientX - box.left, y: event.clientY - box.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panel.current) return;
    setPosition(
      clamp(
        {
          x: event.clientX - drag.current.x,
          y: event.clientY - drag.current.y,
        },
        panel.current,
      ),
    );
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    if (position) writeJson(POSITION_KEY, position);
  };

  return (
    <div
      ref={panel}
      className={`fixed z-40 w-[min(22rem,calc(100vw-1rem))] rounded-container border border-border bg-level-2 shadow-lg print:hidden ${
        position
          ? ""
          : "top-[calc(env(safe-area-inset-top)+5rem)] left-1/2 -translate-x-1/2 compact:top-[calc(env(safe-area-inset-top)+3.5rem)]"
      }`}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div
        className="flex cursor-grab touch-none items-center gap-1 px-2 pt-2 text-muted select-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <GripVertical aria-hidden size={14} />
        <Text variant="label" tone="muted">
          {t("timers.title", { count: timers.length })}
        </Text>
      </div>
      <div className="max-h-[40dvh] overflow-y-auto">
        {timers.map((timer) => (
          <TimerRow key={timer.id} timer={timer} now={now} />
        ))}
      </div>
    </div>
  );
}
