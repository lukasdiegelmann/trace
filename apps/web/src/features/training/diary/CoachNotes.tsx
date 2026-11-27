import {
  Avatar,
  Button,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { MessageSquareReply, Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "../common/assets";
import type { CoachFeedback } from "../lib/workoutTypes";
import { useDiaryFormats } from "./format";

export interface CoachReplyActions {
  /** Opening the reply also marks the note seen */
  onOpen: (note: CoachFeedback) => void;
  onSave: (note: CoachFeedback, reply: string) => Promise<boolean>;
  onDelete: (note: CoachFeedback) => void;
}

export interface CoachNoteProps extends CoachReplyActions {
  note: CoachFeedback;
}

/** A note of the coach with the member's reply */
export function CoachNote({ note, onOpen, onSave, onDelete }: CoachNoteProps) {
  const { t } = useTranslation("training");
  const { ago } = useDiaryFormats();
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const coach = note.trainer_name || t("diary.feedback.yourTrainer");

  const open = () => {
    setDraft(note.member_reply ?? "");
    onOpen(note);
  };
  const send = async () => {
    const reply = (draft ?? "").trim();
    if (!reply || isSaving) return;
    setIsSaving(true);
    const isSaved = await onSave(note, reply);
    setIsSaving(false);
    if (isSaved) setDraft(null);
  };

  return (
    <Row
      gap={2}
      align="start"
      padding={3}
      radius="lg"
      surface="surface"
      className="border-s-4 border-accent"
    >
      <Avatar
        name={coach}
        src={ltAssetUrl(note.trainer_avatar_url)}
        size={28}
      />
      <Stack gap={1} shouldGrow canShrink>
        <Text variant="caption" tone="muted">
          {[t("diary.feedback.coach", { name: coach }), ago(note.updated_at)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text shouldKeepLineBreaks>{note.note}</Text>
        {draft !== null ? (
          <Stack gap={2}>
            <Input
              multiline
              rows={2}
              autoFocus
              aria-label={t("diary.feedback.replyPlaceholder")}
              placeholder={t("diary.feedback.replyPlaceholder")}
              value={draft}
              onValueChange={setDraft}
            />
            <Row gap={2} justify="end">
              {note.member_reply && (
                <Button
                  size="sm"
                  variant="danger"
                  text={t("diary.feedback.delete")}
                  onClick={() => {
                    setDraft(null);
                    onDelete(note);
                  }}
                />
              )}
              <Button
                size="sm"
                text={t("diary.feedback.cancel")}
                onClick={() => {
                  setDraft(null);
                }}
              />
              <Button
                size="sm"
                variant="primary"
                text={
                  isSaving
                    ? t("diary.feedback.sending")
                    : t("diary.feedback.send")
                }
                isDisabled={isSaving || !draft.trim()}
                onClick={() => void send()}
              />
            </Row>
          </Stack>
        ) : note.member_reply ? (
          <Row gap={2} align="start" justify="between">
            <Stack gap={0}>
              <Text variant="caption" tone="muted">
                {[t("diary.feedback.yourReply"), ago(note.member_replied_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text variant="small" shouldKeepLineBreaks>
                {note.member_reply}
              </Text>
            </Stack>
            <Button
              size="sm"
              aria-label={t("diary.feedback.editReply")}
              onClick={open}
            >
              <Pencil aria-hidden size={14} />
            </Button>
          </Row>
        ) : (
          <Row>
            <Button size="sm" text={t("diary.feedback.reply")} onClick={open}>
              <MessageSquareReply aria-hidden size={14} />
            </Button>
          </Row>
        )}
      </Stack>
    </Row>
  );
}
