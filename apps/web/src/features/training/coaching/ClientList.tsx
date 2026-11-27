/** A coach's clients: activity, sent requests and the client cards */
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Pressable,
  Row,
  Spinner,
  Stack,
  Text,
  Tile,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  Ban,
  Bell,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  LogOut,
  Reply,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ltAssetUrl } from "@/features/training/common/assets";
import {
  activityText,
  coachCountsKey,
  markSeen,
  memberBadge,
  memberLabel,
  sentRequestCount,
  unreadByMember,
} from "@/features/training/lib/coaching";

import { EmptyNote } from "../common/EmptyNote";
import {
  coachingApi,
  type CoachActivity,
  type Member,
  type SentRequest,
} from "./api";
import { coachingStore } from "./coachingStore";
import { coachingErrorText } from "./errorText";
import { relativeDayText, relativeTimeText } from "./format";
import { RequestSheet } from "./RequestSheet";
import { useCoachingState } from "./useCoachingState";
import { useConfirm } from "./useConfirm";
import { useResource } from "./useResource";

const ACTIVITY_SHOWN = 6;

export function ClientList() {
  const { t } = useTranslation("training");
  const toast = useToast();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const { state } = useCoachingState();
  const [isAdding, setIsAdding] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const members = useResource("members", coachingApi.members);
  const activity = useResource("activity", () => coachingApi.activity(50));

  // Sent requests are asked for only when the state says there are some, and
  // again when its counts move (a decline, an accept); the clients follow.
  const countsKey = state ? coachCountsKey(state) : null;
  const requests = useResource(
    sentRequestCount(state) > 0 ? `requests:${countsKey ?? ""}` : null,
    coachingApi.sentRequests,
  );
  const seenCounts = useRef(countsKey);
  const reloadMembers = members.reload;
  useEffect(() => {
    if (countsKey === null || seenCounts.current === countsKey) return;
    const isFirst = seenCounts.current === null;
    seenCounts.current = countsKey;
    if (!isFirst) void reloadMembers();
  }, [countsKey, reloadMembers]);

  useEffect(() => {
    void coachingStore.ensureFresh();
  }, []);

  const rows = activity.data ?? [];
  const unseen = rows.filter((row) => !row.seen_at).length;
  const byMember = unreadByMember(rows);

  const see = (id?: number) => {
    const at = new Date().toISOString();
    activity.setData((current) => markSeen(current, id, at));
    // A lost mark shows up unread again next time.
    coachingApi.markActivitySeen(id).catch(() => undefined);
  };

  const openActivity = (row: CoachActivity) => {
    see(row.id);
    // A reply opens the workout it is about right away.
    void navigate(`/training/coaching/${row.member_id}`, {
      state:
        row.kind === "feedback_reply" && row.workout_date
          ? { openWorkoutDate: row.workout_date }
          : null,
    });
  };

  const cancelRequest = async (request: SentRequest) => {
    const name = request.client.name;
    const isConfirmed = await confirm({
      title: t("coaching.requests.cancelTitle", { name }),
      message: t("coaching.requests.cancelMessage", { name }),
      confirmText: t("coaching.requests.cancel"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    setCancellingId(request.id);
    try {
      await coachingApi.endPairing(request.id, "pending");
      toast.info(t("coaching.requests.cancelled"));
    } catch (error) {
      toast.error(coachingErrorText(error, t, name));
    }
    await coachingStore.refresh();
    await requests.reload();
    setCancellingId(null);
  };

  return (
    <Stack gap={4} padding={4} fill="width" maxWidth="2xl" isCentered>
      <Row gap={3} align="center" justify="between">
        <Text variant="title" as="h1">
          {t("coaching.title")}
        </Text>
        <Button
          variant="primary"
          size="md"
          text={t("coaching.add")}
          aria-label={t("coaching.addClient")}
          onClick={() => {
            setIsAdding(true);
          }}
        >
          <UserPlus aria-hidden size={16} />
        </Button>
      </Row>

      {rows.length > 0 ? (
        <Stack as="section" gap={2}>
          <Row gap={2} align="center" justify="between">
            <Row gap={2} align="center">
              <Text variant="heading" as="h2">
                {t("coaching.activity.title")}
              </Text>
              {unseen > 0 ? (
                <Chip
                  tone="accent"
                  text={String(unseen)}
                  aria-label={t("coaching.unread", { count: unseen })}
                />
              ) : null}
            </Row>
            {unseen > 0 ? (
              <Button
                size="sm"
                text={t("coaching.activity.markAllSeen")}
                onClick={() => {
                  see();
                }}
              />
            ) : null}
          </Row>
          {rows.slice(0, ACTIVITY_SHOWN).map((row) => (
            <ActivityRow
              key={row.id}
              row={row}
              onPress={() => {
                openActivity(row);
              }}
            />
          ))}
        </Stack>
      ) : null}

      {requests.data && requests.data.length > 0 ? (
        <Stack as="section" gap={2}>
          <Text variant="heading" as="h2">
            {t("coaching.requests.title")}
          </Text>
          {requests.data.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              isBusy={cancellingId === request.id}
              onCancel={() => {
                void cancelRequest(request);
              }}
            />
          ))}
        </Stack>
      ) : null}

      {members.isLoading ? (
        <Spinner size="lg" label={t("coaching.loadingClients")} />
      ) : members.error && !members.data ? (
        <EmptyNote
          text={t("common.loadFailed", {
            message: coachingErrorText(members.error, t),
          })}
          action={{
            text: t("common.retry"),
            onClick: () => {
              void members.reload();
            },
          }}
        />
      ) : members.data?.length === 0 ? (
        <Stack gap={2} align="center">
          <Users aria-hidden size={32} className="text-muted" />
          <Text variant="heading">{t("coaching.noClients")}</Text>
          <Text tone="muted" align="center">
            {t("coaching.noClientsHint")}
          </Text>
        </Stack>
      ) : (
        <Stack gap={2}>
          {members.data?.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              badge={memberBadge(member, byMember)}
              onPress={() => {
                void navigate(`/training/coaching/${member.id}`);
              }}
            />
          ))}
        </Stack>
      )}

      {isAdding ? (
        <RequestSheet
          onClose={() => {
            setIsAdding(false);
          }}
          onSent={() => {
            void coachingStore.refresh();
          }}
        />
      ) : null}
      {dialog}
    </Stack>
  );
}

function ActivityRow({
  row,
  onPress,
}: {
  row: CoachActivity;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation("training");
  const text = activityText(row);
  const workout =
    "workout" in text ? (text.workout ?? t("coaching.activity.aWorkout")) : "";
  const label =
    text.type === "completed"
      ? t("coaching.activity.completed", { workout })
      : text.type === "missed"
        ? t("coaching.activity.missed", { workout, date: text.date ?? "" })
        : text.type === "replied"
          ? t("coaching.activity.replied", { text: text.text })
          : text.type === "repliedNote"
            ? t("coaching.activity.repliedNote")
            : text.kind;
  const icon =
    row.kind === "prescription_completed" ? (
      <CircleCheck aria-hidden size={20} className="text-success" />
    ) : row.kind === "prescription_missed" ? (
      <CircleAlert aria-hidden size={20} className="text-destructive" />
    ) : row.kind === "feedback_reply" ? (
      <Reply aria-hidden size={20} className="text-accent-text" />
    ) : (
      <Bell aria-hidden size={20} className="text-muted" />
    );
  const name =
    row.member_full_name ||
    row.member_username ||
    t("coaching.clientNumber", { id: row.member_id });

  return (
    <Pressable
      fill="width"
      padding={3}
      border="all"
      radius="lg"
      className={row.seen_at ? undefined : "bg-level-2"}
      onPress={onPress}
    >
      <Row gap={3} align="center">
        {icon}
        <Box shouldGrow>
          <Text variant="small" as="div">
            <strong>{name}</strong> {label}
          </Text>
          <Text variant="caption" as="div">
            {relativeTimeText(row.occurred_at, t, i18n.language)}
          </Text>
        </Box>
        {row.seen_at ? null : (
          <span className="size-2 shrink-0 rounded-full bg-accent">
            <span className="sr-only">{t("coaching.activity.unseen")}</span>
          </span>
        )}
      </Row>
    </Pressable>
  );
}

function RequestRow({
  request,
  isBusy,
  onCancel,
}: {
  request: SentRequest;
  isBusy: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation("training");
  return (
    <Tile>
      <Row gap={3} align="center">
        {request.status === "pending" ? (
          <Clock aria-hidden size={20} className="text-accent-text" />
        ) : request.status === "declined" ? (
          <Ban aria-hidden size={20} className="text-muted" />
        ) : (
          <LogOut aria-hidden size={20} className="text-muted" />
        )}
        <Box shouldGrow>
          <Text variant="small" as="div">
            {request.client.name}
          </Text>
          <Text variant="caption" as="div">
            {request.status === "pending"
              ? t("coaching.requests.waiting")
              : request.status === "declined"
                ? t("coaching.requests.declined")
                : t("coaching.requests.left")}
          </Text>
        </Box>
        {request.status === "pending" ? (
          <Button
            variant="secondary"
            size="sm"
            text={t("coaching.requests.cancel")}
            isDisabled={isBusy}
            onClick={onCancel}
          />
        ) : null}
      </Row>
    </Tile>
  );
}

function MemberCard({
  member,
  badge,
  onPress,
}: {
  member: Member;
  badge: number;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation("training");
  const name = memberLabel(member);
  return (
    <Pressable
      fill="width"
      padding={3}
      border="all"
      radius="lg"
      onPress={onPress}
    >
      <Row gap={3} align="center">
        <Badge count={badge} label={t("coaching.unread", { count: badge })}>
          <span aria-hidden>
            <Avatar src={ltAssetUrl(member.avatar_url)} name={name} size={44} />
          </span>
        </Badge>
        <Box shouldGrow>
          <Text variant="body" as="div">
            {name}
          </Text>
          <Row gap={2} align="center" shouldWrap>
            {member.active_program ? (
              <Chip text={member.active_program} />
            ) : null}
            <Text variant="caption">
              {t("coaching.lastWorkout", {
                when: relativeDayText(
                  member.last_workout_date,
                  t,
                  i18n.language,
                ),
              })}
            </Text>
            <Text variant="caption">
              {t("coaching.thisWeek", { count: member.week_count })}
            </Text>
          </Row>
        </Box>
        <ChevronRight aria-hidden size={18} className="text-muted" />
      </Row>
    </Pressable>
  );
}
