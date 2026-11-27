/** The Coach screen, for the person being coached (Coach.svelte) */
import {
  Box,
  Button,
  Row,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
  Tile,
  useToast,
} from "@monocircuit/monolithium/components";
import { Dumbbell, Info, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useSetting } from "@/features/shared/settings";
import {
  formatServerDay,
  initial,
  showsCoachTab,
} from "@/features/training/lib/coaching";

import { EmptyNote } from "../common/EmptyNote";
import { coachingApi, type CoachingState, type CoachRequest } from "./api";
import { coachingStore } from "./coachingStore";
import { Conversation } from "./Conversation";
import { coachingErrorText } from "./errorText";
import { useCoachingState, useLtUserId } from "./useCoachingState";
import { useConfirm } from "./useConfirm";

export function CoachPage() {
  return (
    <>
      <Coach />
    </>
  );
}

function Coach() {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const { state, status, error } = useCoachingState();
  const myId = useLtUserId();
  /** The state was asked for again since this screen opened */
  const [isFresh, setIsFresh] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void coachingStore.ensureFresh().then(() => {
      if (isCurrent) setIsFresh(true);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  // Left, declined or ended by the coach: back to Programs, not an empty page.
  const hasNothing = isFresh && state !== null && !showsCoachTab(state);
  useEffect(() => {
    if (hasNothing) void navigate("/training/programs", { replace: true });
  }, [hasNothing, navigate]);

  return (
    <Stack gap={4} padding={4} fill="width" maxWidth="2xl" isCentered>
      <Text variant="title" as="h1">
        {t("coach.title")}
      </Text>
      {state ? (
        <CoachContent state={state} myId={myId} />
      ) : status === "error" ? (
        <EmptyNote
          text={t("common.loadFailed", {
            message: coachingErrorText(error, t),
          })}
          action={{
            text: t("common.retry"),
            onClick: () => {
              void coachingStore.refresh();
            },
          }}
        />
      ) : (
        <Spinner size="lg" label={t("common.loading")} />
      )}
    </Stack>
  );
}

function CoachContent({
  state,
  myId,
}: {
  state: CoachingState;
  myId: number | null;
}) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [dateFormat] = useSetting("lt", "dateFormat");
  const [isBusy, setIsBusy] = useState(false);
  const [chosenPastId, setChosenPastId] = useState<number | null>(null);

  const pairing = state.as_client;
  const coachName = pairing?.coach.name ?? "";
  const { requests, past } = state;
  const shownPast =
    past.find((p) => p.id === chosenPastId) ?? past.at(0) ?? null;

  const act = async (call: () => Promise<CoachingState>, success: string) => {
    setIsBusy(true);
    try {
      coachingStore.set(await call());
      toast.info(success);
    } catch (error) {
      toast.error(coachingErrorText(error, t));
      await coachingStore.refresh();
    } finally {
      setIsBusy(false);
    }
  };

  const accept = (request: CoachRequest) =>
    act(
      () => coachingApi.accept(request.id),
      t("coach.accepted", { name: request.coach.name }),
    );

  const decline = async (request: CoachRequest) => {
    const name = request.coach.name;
    const isConfirmed = await confirm({
      title: t("coach.declineTitle", { name }),
      message: t("coach.declineMessage", { name }),
      confirmText: t("coach.decline"),
    });
    if (!isConfirmed) return;
    await act(() => coachingApi.decline(request.id), t("coach.declined"));
  };

  const leave = async () => {
    if (!pairing) return;
    const isConfirmed = await confirm({
      title: t("coach.leaveTitle", { name: coachName }),
      message: t("coach.leaveMessage", { name: coachName }),
      confirmText: t("coach.leave"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await act(
      () => coachingApi.endPairing(pairing.id),
      t("coach.left", { name: coachName }),
    );
  };

  const since = formatServerDay(pairing?.responded_at, dateFormat);

  return (
    <>
      {pairing ? (
        <Tile>
          <Row gap={3} align="center" shouldWrap>
            <div
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-heading text-accent-text"
            >
              {initial(coachName)}
            </div>
            <Box shouldGrow minWidth={48}>
              <Text variant="label" as="div">
                {t("coach.yourCoach")}
              </Text>
              <Text variant="heading" as="h2">
                {coachName}
              </Text>
              {since ? (
                <Text variant="caption">
                  {t("coach.since", { date: since })}
                </Text>
              ) : null}
            </Box>
            <Button
              variant="danger"
              size="md"
              text={t("coach.leave")}
              isDisabled={isBusy}
              onClick={() => {
                void leave();
              }}
            >
              <LogOut aria-hidden size={16} />
            </Button>
          </Row>
        </Tile>
      ) : null}

      {requests.map((request) => (
        <Tile key={request.id}>
          <Stack
            as="section"
            gap={3}
            aria-label={t("coach.requestTitle", { name: request.coach.name })}
          >
            <Row gap={3} align="center">
              <Dumbbell aria-hidden size={24} className="text-accent-text" />
              <Text variant="heading" as="h2">
                {t("coach.requestTitle", { name: request.coach.name })}
              </Text>
            </Row>
            <Text tone="muted">
              {t("coach.requestBody", { name: request.coach.name })}
            </Text>
            {request.note ? (
              <blockquote className="rounded-control border-l-4 border-border bg-level-2 px-3 py-2">
                <Text shouldKeepLineBreaks>{request.note}</Text>
              </blockquote>
            ) : null}
            {pairing ? (
              <Row gap={2} align="start">
                <Info aria-hidden size={18} className="shrink-0 text-muted" />
                <Text variant="small" tone="muted">
                  {t("coach.leaveFirst", {
                    coach: coachName,
                    name: request.coach.name,
                  })}
                </Text>
              </Row>
            ) : null}
            <Row gap={2} justify="end">
              <Button
                variant="secondary"
                size="md"
                text={t("coach.decline")}
                isDisabled={isBusy}
                onClick={() => {
                  void decline(request);
                }}
              />
              <Button
                variant="primary"
                size="md"
                text={t("coach.accept")}
                isDisabled={isBusy || !!pairing}
                onClick={() => {
                  void accept(request);
                }}
              />
            </Row>
          </Stack>
        </Tile>
      ))}

      {pairing ? (
        <>
          <Text variant="small" tone="muted">
            {t("coach.coachSees", { name: coachName })}
          </Text>
          {myId !== null ? (
            <Conversation
              key={pairing.id}
              conversation={{ side: "client", pairingId: pairing.id }}
              otherName={coachName}
              myId={myId}
            />
          ) : null}
        </>
      ) : null}

      {shownPast ? (
        <Stack as="section" gap={2}>
          <Text variant="heading" as="h2">
            {t("coach.pastTitle")}
          </Text>
          {past.length > 1 ? (
            <SegmentedControl
              variant="pill"
              aria-label={t("coach.pastPick")}
              value={shownPast.id}
              options={past.map((p) => ({
                value: p.id,
                label: p.unread
                  ? t("coach.pastOption", {
                      name: p.coach.name,
                      count: p.unread,
                    })
                  : p.coach.name,
              }))}
              onChange={setChosenPastId}
            />
          ) : null}
          <Text variant="small" tone="muted">
            {t("coach.pastBody", {
              name: shownPast.coach.name,
              date: formatServerDay(shownPast.ended_at, dateFormat),
            })}
          </Text>
          {myId !== null ? (
            <Conversation
              key={shownPast.id}
              conversation={{ side: "client", pairingId: shownPast.id }}
              otherName={shownPast.coach.name}
              myId={myId}
              isReadOnly
            />
          ) : null}
        </Stack>
      ) : !requests.length && !pairing ? (
        <EmptyNote text={t("coach.none")} />
      ) : null}
      {dialog}
    </>
  );
}
