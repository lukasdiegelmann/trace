/**
 * A client's set video, for the coach: watch it and leave a note stamped with
 * the moment the video is paused at (SetVideoPlayer.svelte, coach mode). The
 * browser sends the cookie with the <video> request and the server answers
 * byte ranges, so seeking streams.
 */
import {
  Button,
  Input,
  Row,
  Sheet,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Crosshair } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "@/features/training/common/assets";
import { videoClock } from "@/features/training/lib/coaching";

import { coachingApi, type SetClip } from "./api";
import { coachingErrorText } from "./errorText";

export interface SetVideoPlayerSheetProps {
  clip: SetClip;
  /** The exercise, so the clip has its context */
  subtitle: string;
  workoutId: number;
  exerciseIdx: number;
  onClose: () => void;
  onNoted: (note: string) => void;
}

export function SetVideoPlayerSheet({
  clip,
  subtitle,
  workoutId,
  exerciseIdx,
  onClose,
  onNoted,
}: SetVideoPlayerSheetProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const [noteText, setNoteText] = useState(clip.note?.body ?? "");
  const [noteAt, setNoteAt] = useState(clip.note?.time_sec ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPlaybackFailed, setHasPlaybackFailed] = useState(false);

  const save = async () => {
    const note = noteText.trim();
    if (!note || isSaving) return;
    setIsSaving(true);
    try {
      await coachingApi.saveFeedback({
        workout_id: workoutId,
        exercise_idx: exerciseIdx,
        exercise_uuid: clip.exercise_uuid,
        note,
        media_id: clip.id,
        media_time_sec: noteAt,
      });
      onNoted(note);
      onClose();
    } catch (error) {
      toast.error(coachingErrorText(error, t));
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("coaching.video.title")}
      description={subtitle || undefined}
    >
      <Stack gap={4}>
        <video
          ref={video}
          src={ltAssetUrl(clip.file_url)}
          aria-label={t("coaching.video.label", { exercise: subtitle })}
          controls
          playsInline
          preload="metadata"
          className="block max-h-[52dvh] w-full rounded-control bg-level-3"
          onError={() => {
            setHasPlaybackFailed(true);
          }}
        />
        {hasPlaybackFailed ? (
          <Text variant="small" tone="danger" role="alert">
            {t("coaching.video.playbackFailed")}
          </Text>
        ) : null}
        {clip.note?.member_reply ? (
          <Stack gap={1}>
            <Text variant="caption">{t("coaching.video.theirReply")}</Text>
            <Text variant="small" shouldKeepLineBreaks>
              {clip.note.member_reply}
            </Text>
          </Stack>
        ) : null}
        <Stack gap={2}>
          <Row gap={2} align="center">
            <Text variant="caption">{t("coaching.video.noteAt")}</Text>
            <Button
              variant="secondary"
              size="sm"
              text={videoClock(noteAt)}
              aria-label={t("coaching.video.markHere", {
                time: videoClock(noteAt),
              })}
              onClick={() => {
                setNoteAt(video.current?.currentTime ?? 0);
              }}
            >
              <Crosshair aria-hidden size={14} />
            </Button>
          </Row>
          <Input
            multiline
            rows={2}
            aria-label={t("coaching.video.noteLabel")}
            placeholder={t("coaching.video.notePlaceholder")}
            value={noteText}
            onChange={(event) => {
              setNoteText(event.target.value);
            }}
          />
          <Button
            variant="primary"
            size="md"
            isFullWidth
            text={
              isSaving ? t("coaching.saving") : t("coaching.video.saveNote")
            }
            isDisabled={!noteText.trim() || isSaving}
            onClick={() => {
              void save();
            }}
          />
        </Stack>
      </Stack>
    </Sheet>
  );
}
