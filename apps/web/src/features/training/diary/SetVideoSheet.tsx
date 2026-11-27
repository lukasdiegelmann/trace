import {
  Button,
  FileInput,
  ProgressBar,
  Row,
  Sheet,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { CircleStop, RotateCcw, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  bareMimeType,
  clipExtension,
  clock,
  defaultSetUuid,
  formatSizeMb,
  isOverClipLimit,
  MAX_RECORD_SECONDS,
  pickRecorderMime,
  RECORD_BITRATE,
} from "../lib/setVideo";
import { posterFromElement, probeVideoBlob } from "../lib/videoPoster";
import type { WorkoutExercise } from "../lib/workoutTypes";
import { setMediaApi, type SetMedia } from "./setMediaApi";

export interface SetVideoSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  exercise: WorkoutExercise | null;
  workoutId: number | null;
  onAttached: (media: SetMedia) => void;
}

interface Clip {
  file: Blob;
  name: string;
  url: string;
  poster: string | null;
  seconds: number | null;
}

type Stage = "choose" | "recording" | "review" | "uploading";

const canRecord = () =>
  typeof MediaRecorder !== "undefined" && "mediaDevices" in navigator;

export function SetVideoSheet(props: SetVideoSheetProps) {
  if (!props.isOpen) return null;
  return <SetVideoSheetContent {...props} />;
}

/** Film or pick a clip and attach it to a set (issue #57) */
function SetVideoSheetContent({
  isOpen,
  onOpenChange,
  exercise,
  workoutId,
  onAttached,
}: SetVideoSheetProps) {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("choose");
  const [setUuid, setSetUuid] = useState(() => defaultSetUuid(exercise?.sets));
  const [clip, setClip] = useState<Clip | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    const active = recorder.current;
    recorder.current = null;
    if (active && active.state !== "inactive") {
      active.onstop = null;
      active.stop();
    }
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  const clipUrl = clip?.url;
  useEffect(() => {
    if (!clipUrl) return;
    return () => {
      URL.revokeObjectURL(clipUrl);
    };
  }, [clipUrl]);

  const sets = exercise?.sets;
  // The camera goes off with the sheet
  useEffect(() => stopCamera, [stopCamera]);

  const record = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
    } catch {
      toast.error(t("setVideo.noCamera"));
      return;
    }
    setStage("recording");
    setElapsed(0);
    const mime = pickRecorderMime((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const next = new MediaRecorder(stream.current, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: RECORD_BITRATE,
    });
    const chunks: Blob[] = [];
    const started = Date.now();
    let poster: string | null = null;
    next.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    next.onstop = () => {
      const type = bareMimeType(next.mimeType || mime);
      const blob = new Blob(chunks, { type });
      const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
      stopCamera();
      setClip({
        file: blob,
        name: `set-${Date.now()}.${clipExtension(type)}`,
        url: URL.createObjectURL(blob),
        poster,
        seconds,
      });
      setStage("review");
    };
    recorder.current = next;
    next.start();
    ticker.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      poster = posterFromElement(preview.current) ?? poster;
      setElapsed(seconds);
      if (seconds >= MAX_RECORD_SECONDS && next.state !== "inactive") {
        next.stop();
      }
    }, 500);
  };

  const pickFile = async (file: File) => {
    if (isOverClipLimit(file.size)) {
      toast.error(t("setVideo.tooLarge"));
      return;
    }
    const probe = await probeVideoBlob(file);
    setClip({
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      poster: probe.poster,
      seconds: probe.duration,
    });
    setStage("review");
  };

  const attach = async () => {
    if (!clip || workoutId == null) return;
    setStage("uploading");
    setProgress(10);
    try {
      const file =
        clip.file instanceof File
          ? clip.file
          : new File([clip.file], clip.name, {
              type: bareMimeType(clip.file.type),
            });
      const upload = await setMediaApi.upload(file);
      setProgress(70);
      const media = await setMediaApi.attach({
        workout_id: workoutId,
        exercise_uuid: exercise?.uuid,
        set_uuid: setUuid,
        url: upload.url,
        mime: upload.mimeType,
        size_bytes: upload.sizeBytes ?? file.size,
        duration_sec: clip.seconds,
      });
      onAttached(media);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("setVideo.uploadFailed"),
      );
      setStage("review");
    }
  };

  const isOffline = !navigator.onLine;
  const size = clip ? formatSizeMb(clip.file.size, i18n.language) : "";

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("setVideo.title")}
      description={exercise?.exercise_name}
    >
      {isOffline ? (
        <Text>{t("setVideo.needsConnection")}</Text>
      ) : (
        <Stack gap={4}>
          {stage !== "uploading" && (sets?.length ?? 0) > 1 && (
            <Row
              gap={1}
              shouldWrap
              role="group"
              aria-label={t("setVideo.whichSet")}
            >
              {sets?.map((set, i) => (
                <Button
                  key={set.uuid ?? i}
                  size="sm"
                  variant={set.uuid === setUuid ? "primary" : "secondary"}
                  aria-pressed={set.uuid === setUuid}
                  text={set.completed ? `${i + 1} ✓` : String(i + 1)}
                  aria-label={t(
                    set.completed
                      ? "setVideo.setNumberDone"
                      : "setVideo.setNumber",
                    { n: i + 1 },
                  )}
                  onClick={() => {
                    setSetUuid(set.uuid ?? null);
                  }}
                />
              ))}
            </Row>
          )}

          {stage === "choose" && (
            <Stack gap={4}>
              {canRecord() && (
                <Stack gap={1}>
                  <Button
                    variant="primary"
                    text={t("setVideo.record")}
                    onClick={() => void record()}
                  >
                    <Video aria-hidden size={16} />
                  </Button>
                  <Text variant="caption" tone="muted">
                    {t("setVideo.recordHint", {
                      seconds: MAX_RECORD_SECONDS,
                    })}
                  </Text>
                </Stack>
              )}
              <Stack gap={1}>
                <FileInput
                  accept="video/*"
                  text={t("setVideo.choose")}
                  placeholder={t("setVideo.noFileSelected")}
                  file={null}
                  onChange={(file) => {
                    if (file) void pickFile(file);
                  }}
                />
                <Text variant="caption" tone="muted">
                  {t("setVideo.chooseHint")}
                </Text>
              </Stack>
            </Stack>
          )}

          {stage === "recording" && (
            <Stack gap={3} align="center">
              <video
                ref={(node) => {
                  preview.current = node;
                  if (node && node.srcObject !== stream.current) {
                    node.srcObject = stream.current;
                  }
                }}
                aria-label={t("setVideo.preview")}
                autoPlay
                muted
                playsInline
                className="max-h-80 w-full rounded-container bg-level-2"
              />
              <Row gap={2} align="center">
                <span
                  aria-label={t("setVideo.recording")}
                  className="size-2.5 animate-pulse rounded-full bg-destructive"
                />
                <Text variant="mono">{clock(elapsed)}</Text>
                <Text variant="caption" tone="muted">
                  {t("setVideo.secondsLeft", {
                    seconds: Math.max(0, MAX_RECORD_SECONDS - elapsed),
                  })}
                </Text>
              </Row>
              <Button
                variant="danger"
                isEmphasized
                text={t("setVideo.stop")}
                onClick={() => {
                  if (recorder.current?.state !== "inactive") {
                    recorder.current?.stop();
                  }
                }}
              >
                <CircleStop aria-hidden size={16} />
              </Button>
            </Stack>
          )}

          {stage === "review" && clip && (
            <Stack gap={3}>
              <video
                src={clip.url}
                poster={clip.poster ?? undefined}
                controls
                playsInline
                className="max-h-80 w-full rounded-container bg-level-2"
              />
              <Text variant="caption" tone="muted">
                {clip.seconds
                  ? t("setVideo.clipMeta", { time: clock(clip.seconds), size })
                  : t("setVideo.clipSize", { size })}
              </Text>
              <Row gap={2} justify="end">
                <Button
                  variant="secondary"
                  text={t("setVideo.retake")}
                  onClick={() => {
                    setClip(null);
                    setStage("choose");
                  }}
                >
                  <RotateCcw aria-hidden size={16} />
                </Button>
                <Button
                  variant="primary"
                  text={t("setVideo.attach")}
                  isDisabled={workoutId == null}
                  onClick={() => void attach()}
                />
              </Row>
            </Stack>
          )}

          {stage === "uploading" && (
            <Stack gap={2}>
              <Text>{t("setVideo.uploading")}</Text>
              <ProgressBar
                value={progress / 100}
                label={t("setVideo.uploading")}
                className="h-1.5"
              />
            </Stack>
          )}
        </Stack>
      )}
    </Sheet>
  );
}
