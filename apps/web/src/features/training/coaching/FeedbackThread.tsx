/** What goes under a note: seen or answered, and other coaches' notes */
import {
  Avatar,
  Box,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ltAssetUrl } from "@/features/training/common/assets";

import type { CoachFeedback } from "./api";
import { relativeTimeText } from "./format";

export interface FeedbackThreadProps {
  /** The notes of this spot, every coach's */
  feedback: CoachFeedback[];
  myId: number | null;
  memberName: string;
  memberAvatar: string | null;
}

export function FeedbackThread({
  feedback,
  myId,
  memberName,
  memberAvatar,
}: FeedbackThreadProps) {
  const { t, i18n } = useTranslation("training");
  const when = (ts: string | null) => relativeTimeText(ts, t, i18n.language);
  const mine = feedback.filter((f) => f.trainer_id === myId);
  const others = feedback.filter((f) => f.trainer_id !== myId);

  return (
    <>
      {mine.map((f) => (
        <Stack key={f.id} gap={1}>
          {f.seen_by_member_at && !f.member_reply ? (
            <Row gap={1} align="center">
              <CheckCheck aria-hidden size={14} className="text-muted" />
              <Text variant="caption">
                {t("coaching.workout.seenBy", {
                  name: memberName,
                  when: when(f.seen_by_member_at),
                })}
              </Text>
            </Row>
          ) : null}
          {f.member_reply ? (
            <Row gap={2} align="start">
              <span aria-hidden>
                <Avatar
                  src={ltAssetUrl(memberAvatar)}
                  name={memberName}
                  size={24}
                />
              </span>
              <Box shouldGrow>
                <Text variant="caption" as="div">
                  {f.member_replied_at
                    ? t("coaching.workout.repliedWhen", {
                        name: memberName,
                        when: when(f.member_replied_at),
                      })
                    : t("coaching.workout.replied", { name: memberName })}
                </Text>
                <Text variant="small" shouldKeepLineBreaks>
                  {f.member_reply}
                </Text>
              </Box>
            </Row>
          ) : null}
        </Stack>
      ))}
      {others.map((f) => (
        <Text key={f.id} variant="small" tone="muted" shouldKeepLineBreaks>
          <strong>{f.trainer_name}:</strong> {f.note}
        </Text>
      ))}
    </>
  );
}
