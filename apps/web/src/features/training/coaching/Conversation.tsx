/**
 * A coach and a client's conversation: text up to 4,000 characters and one
 * photo per message. A message written without a connection waits and goes
 * once (its uuid). Checked when opened, when the app comes back to the
 * front, and every 10 seconds only while it is on screen.
 */
import {
  Button,
  FileInput,
  Input,
  Row,
  ScrollArea,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Send, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";
import { formatDay, serverDate } from "@/features/training/lib/coaching";
import {
  conversationPath,
  hasUnreadFromOther,
  lastReadUuid,
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX,
  trimMessage,
  withDays,
  type Conversation as ConversationRef,
} from "@/features/training/lib/coachingMessages";
import {
  isRetryable,
  type LocalMessage,
} from "@/features/training/lib/coachingOutbox";
import { embeddablePhoto } from "@/features/training/lib/coachingPhoto";

import { EmptyNote } from "../common/EmptyNote";
import { coachingApi } from "./api";
import { CoachPhoto } from "./CoachPhoto";
import { coachingStore } from "./coachingStore";
import { coachOutbox } from "./outbox";
import { forgetCoachPhotos } from "./photos";
import { useConfirm } from "./useConfirm";

export const POLL_MS = 10_000;

export interface ConversationProps {
  conversation: ConversationRef;
  otherName: string;
  myId: number;
  /** Ended coaching: the client still reads it, nobody writes */
  isReadOnly?: boolean;
}

export function Conversation({
  conversation,
  otherName,
  myId,
  isReadOnly = false,
}: ConversationProps) {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [dateFormat] = useSetting("lt", "dateFormat");
  const [timeFormat] = useSetting("lt", "timeFormat");
  const { pairingId } = conversation;
  const path = conversationPath(conversation);

  const messages = useSyncExternalStore(coachOutbox.subscribe, () =>
    coachOutbox.list(pairingId),
  );
  const [canSend, setCanSend] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  // The log follows new messages while it is at the end; an own message
  // takes it there from anywhere.
  const log = useRef<HTMLElement>(null);
  const [sentCount, setSentCount] = useState(0);
  useLayoutEffect(() => {
    const element = log.current;
    if (element && sentCount) element.scrollTop = element.scrollHeight;
  }, [sentCount]);

  const pull = useCallback(async () => {
    const list = await coachingApi.messages(
      path,
      coachOutbox.cursor(pairingId),
    );
    forgetCoachPhotos(coachOutbox.merge(list.messages));
    coachOutbox.setCursor(pairingId, list.server_time);
    return list;
  }, [path, pairingId]);

  const check = useCallback(async () => {
    const flushed = await coachOutbox.flush();
    if (flushed.isOffline) setIsOffline(true);
    try {
      const list = await pull();
      setIsOffline(false);
      setCanSend(list.can_send);
      if (
        hasUnreadFromOther(coachOutbox.list(pairingId), myId) &&
        document.visibilityState === "visible"
      ) {
        await coachingApi.markRead(path);
        await pull();
        void coachingStore.refresh();
      }
    } catch (error) {
      if (isRetryable(error)) setIsOffline(true);
    } finally {
      setIsChecked(true);
    }
  }, [pull, pairingId, myId, path]);

  useEffect(() => {
    let isRunning = false;
    const run = () => {
      if (isRunning) return;
      isRunning = true;
      void check().finally(() => {
        isRunning = false;
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    run();
    document.addEventListener("visibilitychange", onVisible);
    // An ended conversation has nothing new to bring.
    const timer = isReadOnly ? null : window.setInterval(onVisible, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [check, isReadOnly]);

  const isClosed = isReadOnly || !canSend;
  const isEmptyDraft = !trimMessage(text).trim() && !photo;

  const flushNow = async (run: ReturnType<typeof coachOutbox.flush>) => {
    const result = await run;
    setIsOffline(result.isOffline);
  };

  const send = () => {
    if (isClosed || isEmptyDraft) return;
    if (trimMessage(text).length > MESSAGE_MAX) {
      toast.error(
        t("conversation.tooLong", {
          max: MESSAGE_MAX.toLocaleString(i18n.language),
        }),
      );
      return;
    }
    coachOutbox.enqueue({
      pairingId,
      senderId: myId,
      postPath: path,
      body: text,
      image: photo,
    });
    setText("");
    setPhoto(null);
    setSentCount((count) => count + 1);
    void flushNow(coachOutbox.flush());
  };

  const pickPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) throw new Error("not a photo");
      setPhoto(await embeddablePhoto(file));
    } catch {
      toast.error(t("conversation.photoUnreadable"));
    }
  };

  const remove = async (message: LocalMessage) => {
    const isConfirmed = await confirm({
      title: t("conversation.deleteTitle"),
      message: t("conversation.deleteMessage", { name: otherName }),
      confirmText: t("conversation.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    const image = coachOutbox.deleteOwn(message.uuid);
    if (image) forgetCoachPhotos([image]);
    void flushNow(coachOutbox.flush());
  };

  const timeOf = (timestamp: string) =>
    serverDate(timestamp).toLocaleTimeString(i18n.language, {
      hour: "numeric",
      minute: "2-digit",
      hour12: timeFormat !== "24h",
    });

  const lastRead = lastReadUuid(messages, myId);
  const placeholder = t("conversation.placeholder", { name: otherName });

  return (
    <Stack
      as="section"
      gap={2}
      aria-label={t("conversation.label", { name: otherName })}
    >
      <ScrollArea
        ref={log}
        gap={2}
        padding={3}
        border="all"
        radius="lg"
        maxHeight="tall"
        shouldGrow={false}
        shouldFollowEnd
        role="log"
        aria-label={t("conversation.log", { name: otherName })}
      >
        {messages.length === 0 ? (
          !isChecked ? (
            <Spinner label={t("common.loading")} />
          ) : (
            <EmptyNote
              text={
                isReadOnly
                  ? t("conversation.emptyClosed")
                  : t("conversation.empty", { name: otherName })
              }
            />
          )
        ) : null}
        {withDays(messages).map(({ message, day, isNewDay }) => {
          const isMine = message.sender_id === myId;
          const photoPath = message.imageLocal ?? message.image;
          return (
            <div key={message.uuid} className="flex flex-col gap-1">
              {isNewDay ? (
                <Text variant="caption" align="center">
                  {formatDay(day, dateFormat)}
                </Text>
              ) : null}
              <div
                className={`flex max-w-[85%] flex-col gap-1 ${isMine ? "items-end self-end" : "items-start self-start"}`}
              >
                <div
                  data-mine={isMine || undefined}
                  className={`flex max-w-full flex-col gap-2 rounded-container px-3 py-2 ${
                    message.deleted_at
                      ? "border border-dashed border-border"
                      : isMine
                        ? "bg-accent/20"
                        : "bg-level-2"
                  }`}
                >
                  {message.deleted_at ? (
                    <Text variant="small" tone="muted" className="italic">
                      {t("conversation.deleted")}
                    </Text>
                  ) : (
                    <>
                      {photoPath ? <CoachPhoto path={photoPath} /> : null}
                      {message.body ? (
                        <Text variant="small" shouldKeepLineBreaks>
                          {message.body}
                        </Text>
                      ) : null}
                    </>
                  )}
                </div>
                <Row gap={2} align="center" shouldWrap>
                  <Text variant="caption">{timeOf(message.created_at)}</Text>
                  {message.syncStatus === "pending" ? (
                    <Text variant="caption">
                      {isOffline
                        ? t("conversation.waiting")
                        : t("conversation.sending")}
                    </Text>
                  ) : null}
                  {message.syncStatus === "failed" ? (
                    <>
                      <Text
                        variant="caption"
                        tone="danger"
                        title={message.error ?? undefined}
                      >
                        {t("conversation.notSent")}
                      </Text>
                      {!isClosed ? (
                        <Button
                          size="sm"
                          text={t("conversation.tryAgain")}
                          onClick={() => {
                            void flushNow(coachOutbox.retry(message.uuid));
                          }}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {message.uuid === lastRead ? (
                    <Text variant="caption">{t("conversation.read")}</Text>
                  ) : null}
                  {isMine && !message.deleted_at ? (
                    <Button
                      size="sm"
                      aria-label={t("conversation.delete")}
                      onClick={() => {
                        void remove(message);
                      }}
                    >
                      <Trash2 aria-hidden size={14} />
                    </Button>
                  ) : null}
                </Row>
              </div>
            </div>
          );
        })}
      </ScrollArea>

      {isClosed ? (
        <Text variant="small" tone="muted" align="center">
          {t("conversation.closed")}
        </Text>
      ) : (
        <Stack gap={2}>
          {photo ? (
            <Row gap={2} align="start">
              <img
                src={photo}
                alt={t("conversation.photo")}
                className="block max-h-32 max-w-40 rounded-control"
              />
              <Button
                size="sm"
                variant="secondary"
                aria-label={t("conversation.removePhoto")}
                onClick={() => {
                  setPhoto(null);
                }}
              >
                <X aria-hidden size={14} />
              </Button>
            </Row>
          ) : null}
          <Input
            multiline
            value={text}
            maxLength={MESSAGE_MAX}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => {
              setText(event.target.value);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send();
              }
            }}
          />
          <Row gap={2} align="center" justify="between">
            {/* TODO(monolithium): an icon-only attach button; FileInput always
                shows a text button and a file name slot */}
            <FileInput
              accept="image/*"
              capture="environment"
              file={null}
              text={t("conversation.addPhoto")}
              captureText={t("conversation.takePhoto")}
              placeholder=""
              disabled={!!photo}
              onChange={(file) => {
                void pickPhoto(file);
              }}
            />
            <Button
              variant="primary"
              size="md"
              text={t("conversation.send")}
              isDisabled={isEmptyDraft}
              onClick={send}
            >
              <Send aria-hidden size={16} />
            </Button>
          </Row>
          {text.length > MESSAGE_COUNTER_FROM ? (
            <Text variant="caption">
              {t("conversation.count", {
                n: text.length.toLocaleString(i18n.language),
                max: MESSAGE_MAX.toLocaleString(i18n.language),
              })}
            </Text>
          ) : null}
          {isOffline ? (
            <Text variant="caption" role="status">
              {t("conversation.offline")}
            </Text>
          ) : null}
        </Stack>
      )}
      {dialog}
    </Stack>
  );
}
