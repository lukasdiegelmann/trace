import {
  Button,
  FileInput,
  Input,
  Markdown,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Mic, Send, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { aiErrorText, type AssistantToolset } from "@/features/shared/ai";

import { CardView } from "./CardView";
import { imageDataUrl } from "./lib/images";
import { startDictation, type Dictation } from "./lib/speech";
import { messageTime } from "./lib/messages";
import type { Chat } from "./useChat";

function Bubble({
  isOwn,
  isError,
  children,
}: {
  isOwn: boolean;
  isError?: boolean;
  children: React.ReactNode;
}) {
  // TODO(monolithium): a chat message bubble.
  return (
    <div
      className={`max-w-[85%] rounded-container px-3 py-2 ${isOwn ? "self-end bg-level-2" : "self-start bg-level-1"} ${isError ? "text-danger" : ""}`}
    >
      {children}
    </div>
  );
}

export interface ChatPanelProps {
  chat: Chat;
  toolsets: readonly AssistantToolset[];
  voiceLanguage: string;
  onReplyAction: (toolset: AssistantToolset, text: string) => void;
}

export function ChatPanel({
  chat,
  toolsets,
  voiceLanguage,
  onReplyAction,
}: ChatPanelProps) {
  const { t, i18n } = useTranslation("assistant");
  const [draft, setDraft] = useState("");
  /** "Today" as of when the panel opened */
  const [openedAt] = useState(() => Date.now());
  const [images, setImages] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dictation, setDictation] = useState<Dictation | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const { messages, cards, isBusy, toolName } = chat;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, cards.length, isBusy]);
  useEffect(
    () => () => {
      dictation?.cancel();
    },
    [dictation],
  );

  const send = (text: string) => {
    if (isBusy || (!text.trim() && !images.length)) return;
    dictation?.cancel();
    setDictation(null);
    void chat.send(text, { images });
    setDraft("");
    setImages([]);
  };

  const attach = async (file: File | null) => {
    if (!file) return;
    try {
      const url = await imageDataUrl(file);
      setImages((old) => [...old, url]);
    } catch (caught) {
      setProblem(aiErrorText(caught));
    }
  };

  const toggleDictation = () => {
    if (dictation) {
      dictation.stop();
      return;
    }
    setProblem(null);
    const before = draft ? `${draft.trimEnd()} ` : "";
    setDictation(
      startDictation({
        language: voiceLanguage,
        onText: (heard) => {
          setDraft(before + heard);
        },
        onEnd: () => {
          setDictation(null);
        },
        onProblem: (found) => {
          setProblem(t(`speech.${found}`));
          setDictation(null);
        },
      }),
    );
  };

  const suggestions = toolsets.flatMap((toolset) => toolset.suggestions());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <Stack gap={2}>
            <Text tone="muted">{t("welcome")}</Text>
            <Row gap={2} shouldWrap>
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="secondary"
                  size="sm"
                  text={suggestion}
                  isDisabled={isBusy}
                  onClick={() => {
                    send(suggestion);
                  }}
                />
              ))}
            </Row>
          </Stack>
        ) : null}
        <div
          className="flex flex-col gap-3"
          role="log"
          aria-label={t("conversation")}
          aria-live="polite"
        >
          {messages.map((message) => {
            if (message.role === "note") {
              return (
                <Text key={message.id} variant="caption" tone="muted">
                  {message.text}
                </Text>
              );
            }
            const isOwn = message.role === "user";
            const actions =
              isOwn || message.isError
                ? []
                : toolsets.flatMap((toolset) => {
                    const action = toolset.replyAction?.(message.text);
                    return action ? [{ toolset, ...action }] : [];
                  });
            return (
              <Bubble key={message.id} isOwn={isOwn} isError={message.isError}>
                <Stack gap={2}>
                  {message.images?.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={t("attachedPhoto")}
                      className="max-h-40 rounded-inner object-contain"
                    />
                  ))}
                  {isOwn || message.isError ? (
                    <Text shouldKeepLineBreaks>{message.text}</Text>
                  ) : (
                    <Markdown source={message.text} />
                  )}
                  <Text variant="caption" tone="muted">
                    {messageTime(message.time, openedAt, i18n.language)}
                  </Text>
                  {actions.map((action) => (
                    <Row key={action.toolset.id}>
                      <Button
                        variant="secondary"
                        size="sm"
                        text={action.label}
                        onClick={() => {
                          onReplyAction(action.toolset, action.text);
                        }}
                      />
                    </Row>
                  ))}
                </Stack>
              </Bubble>
            );
          })}
        </div>
        {cards.map((entry) => (
          <CardView
            key={entry.id}
            entry={entry}
            onDiscard={() => {
              chat.discardCard(entry.id);
            }}
            onDone={(line) => {
              chat.finishCard(entry.id, line);
            }}
          />
        ))}
        {isBusy ? (
          <Row gap={2} align="center">
            <Spinner
              size="sm"
              label={
                toolName
                  ? t("calling", { tool: toolName.replace(/_/g, " ") })
                  : t("thinking")
              }
            />
            <Text variant="small" tone="muted">
              {toolName
                ? t("calling", { tool: toolName.replace(/_/g, " ") })
                : t("thinking")}
            </Text>
          </Row>
        ) : null}
        <div ref={end} />
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-3">
        {images.length ? (
          <Row gap={2} shouldWrap>
            {images.map((url, index) => (
              <Row key={index} gap={1} align="center">
                <img
                  src={url}
                  alt={t("attachedPhoto")}
                  className="size-12 rounded-inner object-cover"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("removePhoto")}
                  onClick={() => {
                    setImages((old) => old.filter((_, i) => i !== index));
                  }}
                >
                  <X aria-hidden />
                </Button>
              </Row>
            ))}
          </Row>
        ) : null}
        {problem ? (
          <Text variant="small" tone="danger" role="alert">
            {problem}
          </Text>
        ) : null}
        <Input
          multiline
          aria-label={t("message")}
          placeholder={t("placeholder")}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <Row gap={2} align="center" justify="between">
          <FileInput
            accept="image/*"
            capture="environment"
            text={t("photo")}
            captureText={t("camera")}
            placeholder=""
            variant="ghost"
            size="sm"
            file={null}
            onChange={(file) => void attach(file)}
          />
          <Row gap={2}>
            <Button
              variant={dictation ? "danger" : "ghost"}
              size="md"
              aria-label={t(dictation ? "stopDictation" : "dictate")}
              aria-pressed={dictation !== null}
              onClick={toggleDictation}
            >
              {dictation ? <Square aria-hidden /> : <Mic aria-hidden />}
            </Button>
            <Button
              variant="primary"
              size="md"
              aria-label={t("send")}
              isDisabled={isBusy || (!draft.trim() && !images.length)}
              onClick={() => {
                send(draft);
              }}
            >
              <Send aria-hidden />
            </Button>
          </Row>
        </Row>
      </div>
    </div>
  );
}
