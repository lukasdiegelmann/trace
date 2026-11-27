import {
  Button,
  Dialog,
  Input,
  Row,
  Sheet,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Play, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "../common/assets";
import { clock } from "../lib/setVideo";
import { feedbackApi } from "./api";
import { setMediaApi, type SetMedia } from "./setMediaApi";

export interface SetVideoPlayerProps {
  /** The clip shown, null when closed */
  media: SetMedia | null;
  subtitle?: string;
  onClose: () => void;
  onDeleted: (id: number) => void;
  onReplied: () => void;
}

export function SetVideoPlayer(props: SetVideoPlayerProps) {
  if (!props.media) return null;
  return <SetVideoPlayerContent key={props.media.id} {...props} />;
}

/**
 * A set's clip with the coach's note, as the member sees it. Writing notes on
 * a client's clip belongs to Coaching (issue #8).
 */
function SetVideoPlayerContent({
  media,
  subtitle,
  onClose,
  onDeleted,
  onReplied,
}: SetVideoPlayerProps) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const note = media?.note;
  const reply = sent ?? note?.member_reply;

  const send = async () => {
    const text = draft.trim();
    if (!note || !text || isSending) return;
    setIsSending(true);
    try {
      await feedbackApi.reply(note.id, text);
      setSent(text);
      onReplied();
    } catch {
      toast.error(t("setVideo.replyFailed"));
    }
    setIsSending(false);
  };

  const remove = async () => {
    if (!media) return;
    setIsConfirming(false);
    try {
      await setMediaApi.remove(media.id);
      onDeleted(media.id);
      onClose();
    } catch {
      toast.error(t("setVideo.deleteFailed"));
    }
  };

  return (
    <>
      <Sheet
        isOpen={media !== null}
        onOpenChange={(isStillOpen) => {
          if (!isStillOpen) onClose();
        }}
        title={t("setVideo.playerTitle")}
        description={subtitle}
      >
        {media && (
          <Stack gap={4}>
            <video
              ref={video}
              src={ltAssetUrl(media.file_url)}
              controls
              playsInline
              preload="metadata"
              className="max-h-96 w-full rounded-container bg-level-2"
            />
            {note ? (
              <Stack
                gap={2}
                padding={3}
                radius="lg"
                surface="surface"
                className="border-s-4 border-accent"
              >
                <Row gap={2} align="center" justify="between">
                  <Text variant="label">
                    {note.author || t("setVideo.yourCoach")}
                  </Text>
                  {note.time_sec != null && (
                    <Button
                      size="sm"
                      variant="secondary"
                      text={clock(note.time_sec)}
                      aria-label={t("setVideo.jumpTo", {
                        time: clock(note.time_sec),
                      })}
                      onClick={() => {
                        const player = video.current;
                        if (!player) return;
                        player.currentTime = Math.max(0, note.time_sec ?? 0);
                        void player.play();
                      }}
                    >
                      <Play aria-hidden size={14} />
                    </Button>
                  )}
                </Row>
                <Text shouldKeepLineBreaks>{note.body}</Text>
                {reply ? (
                  <Stack gap={0}>
                    <Text variant="caption" tone="muted">
                      {t("setVideo.yourReply")}
                    </Text>
                    <Text variant="small" shouldKeepLineBreaks>
                      {reply}
                    </Text>
                  </Stack>
                ) : (
                  <Row gap={2} align="end">
                    <Input
                      wrapperClassName="flex-1"
                      aria-label={t("setVideo.replyPlaceholder")}
                      placeholder={t("setVideo.replyPlaceholder")}
                      value={draft}
                      onValueChange={setDraft}
                      onEnter={() => void send()}
                    />
                    <Button
                      variant="primary"
                      text={t("setVideo.send")}
                      isDisabled={isSending || !draft.trim()}
                      onClick={() => void send()}
                    />
                  </Row>
                )}
              </Stack>
            ) : (
              <Text variant="small" tone="muted">
                {t("setVideo.noNote")}
              </Text>
            )}
            <Row>
              <Button
                variant="danger"
                text={t("setVideo.delete")}
                onClick={() => {
                  setIsConfirming(true);
                }}
              >
                <Trash2 aria-hidden size={16} />
              </Button>
            </Row>
          </Stack>
        )}
      </Sheet>
      <Dialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title={t("setVideo.deleteConfirmTitle")}
        description={t("setVideo.deleteConfirmText")}
        cancelText={t("setVideo.cancel")}
        confirmText={t("setVideo.delete")}
        variant="danger"
        onConfirm={remove}
      />
    </>
  );
}
