import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  aiErrorText,
  askAi,
  loadAiSetup,
  type AssistantCard,
  type AssistantToolset,
  type ToolsetId,
  type TurnContext,
} from "@/features/shared/ai";

import {
  clearHistory,
  IMAGE_PLACEHOLDER,
  isSameConversation,
  loadHistory,
  messageId,
  saveHistory,
  toTurns,
  type ChatMessage,
} from "./lib/messages";
import { systemPrompt } from "./lib/prompt";

export interface PendingCard {
  id: string;
  card: AssistantCard;
  /** Set once an action saved it */
  done?: string;
}

export interface SendOptions {
  images?: string[];
  /** Put before the text for the model only (Smart Log by voice) */
  preamble?: string;
}

export interface Chat {
  messages: ChatMessage[];
  cards: PendingCard[];
  isBusy: boolean;
  /** The tool being run, for the thinking line */
  toolName: string | null;
  send: (text: string, options?: SendOptions) => Promise<void>;
  /** Takes the server's history, e.g. when the panel opens */
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
  discardCard: (id: string) => void;
  finishCard: (id: string, done: string) => void;
}

export function useChat(
  toolsets: readonly AssistantToolset[],
  section: ToolsetId | null,
  onReply: () => void,
): Chat {
  const { t, i18n } = useTranslation("assistant");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cards, setCards] = useState<PendingCard[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [toolName, setToolName] = useState<string | null>(null);
  // What a running turn reads must be current, not what it closed over.
  const messagesRef = useRef(messages);
  const cardsRef = useRef(cards);
  const busyRef = useRef(false);
  const hasNotedTools = useRef(false);
  const hasHistory = useRef(false);
  const latestReply = useRef(onReply);
  useEffect(() => {
    latestReply.current = onReply;
  });

  const updateMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);
  const updateCards = useCallback((next: PendingCard[]) => {
    cardsRef.current = next;
    setCards(next);
  }, []);

  const refresh = useCallback(async () => {
    const isBusyNow = () => busyRef.current;
    if (isBusyNow()) return;
    try {
      const history = await loadHistory();
      // A message sent while it loaded is newer than the history.
      if (isBusyNow()) return;
      const hasHadHistory = hasHistory.current;
      hasHistory.current = true;
      if (isSameConversation(messagesRef.current, history)) return;
      updateMessages(history);
      // A reply written on another device counts as unread.
      if (hasHadHistory && history.at(-1)?.role === "assistant") {
        latestReply.current();
      }
    } catch {
      // Offline: what is on screen stays.
    }
  }, [updateMessages]);

  const send = useCallback(
    async (text: string, { images = [], preamble }: SendOptions = {}) => {
      const content = text.trim();
      if (busyRef.current || (!content && !images.length)) return;
      busyRef.current = true;
      setIsBusy(true);
      // Smart Log may send before the panel ever opened: the earlier turns
      // belong on screen and in what the model reads.
      if (!hasHistory.current) {
        try {
          const history = await loadHistory();
          hasHistory.current = true;
          updateMessages([...history, ...messagesRef.current]);
        } catch {
          // Offline: the message goes without the earlier turns.
        }
      }
      const add = (message: Omit<ChatMessage, "id" | "time">) => {
        updateMessages([
          ...messagesRef.current,
          { ...message, id: messageId(), time: Date.now() },
        ]);
      };
      add({ role: "user", text: content, images });
      void saveHistory(
        "user",
        images.length ? `${content} ${IMAGE_PLACEHOLDER}`.trim() : content,
      );
      let lock: WakeLockSentinel | null = null;
      try {
        if ("wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Refused: the request runs anyway.
      }
      try {
        const setup = await loadAiSetup();
        const turn: TurnContext = {
          hasImage: images.length > 0,
          hasPendingCard: (kind) =>
            cardsRef.current.some(
              (entry) => entry.card.kind === kind && !entry.done,
            ),
          addCard: (card) => {
            updateCards([
              // A new proposal replaces an unanswered one of its kind.
              ...cardsRef.current.filter(
                (entry) => entry.card.kind !== card.kind || entry.done,
              ),
              { id: messageId(), card },
            ]);
          },
        };
        const [tools, prompt] = await Promise.all([
          Promise.all(toolsets.map(async (toolset) => toolset.tools(turn))),
          systemPrompt(toolsets, {
            assistantName: setup.assistantName,
            now: new Date(),
            language: i18n.language,
            section,
          }),
        ]);
        const reply = await askAi(
          setup.config,
          {
            systemPrompt: prompt,
            messages: toTurns(messagesRef.current, preamble),
            tools: tools.flat(),
            onToolCall: setToolName,
            onToolsUnsupported: ({ isRouted }) => {
              if (hasNotedTools.current) return;
              hasNotedTools.current = true;
              add({
                role: "note",
                text: t(isRouted ? "toolsRouted" : "toolsUnsupported"),
              });
            },
          },
          setup.shouldUseProxy,
        );
        const answer = reply.trim() || t("emptyReply");
        add({ role: "assistant", text: answer });
        void saveHistory("assistant", answer);
        onReply();
      } catch (caught) {
        add({ role: "assistant", text: aiErrorText(caught), isError: true });
      } finally {
        void lock?.release();
        busyRef.current = false;
        setIsBusy(false);
        setToolName(null);
      }
    },
    [toolsets, section, onReply, t, i18n, updateMessages, updateCards],
  );

  const clear = useCallback(async () => {
    await clearHistory();
    hasNotedTools.current = false;
    updateMessages([]);
    updateCards([]);
  }, [updateMessages, updateCards]);

  // The other device's turns show when the tab comes back.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        messagesRef.current.length
      ) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return {
    messages,
    cards,
    isBusy,
    toolName,
    send,
    refresh,
    clear,
    discardCard: (id) => {
      updateCards(cardsRef.current.filter((entry) => entry.id !== id));
    },
    finishCard: (id, done) => {
      updateCards(
        cardsRef.current.map((entry) =>
          entry.id === id ? { ...entry, done } : entry,
        ),
      );
    },
  };
}
