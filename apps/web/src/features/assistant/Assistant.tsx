/**
 * Trace, the assistant of all three apps: a button over every page, its
 * chat, and the Smart Log of the section on screen. The app shell mounts it
 * once with each domain's toolset.
 */
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  FloatingPanel,
  Row,
  Spinner,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Headphones, Mic, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import {
  aiErrorText,
  useAiSetup,
  type AssistantToolset,
} from "@/features/shared/ai";
import { useSetting } from "@/features/shared/settings";

import { ChatPanel } from "./ChatPanel";
import { sectionOf } from "./lib/prompt";
import { voiceLanguage } from "./lib/speech";
import { useChat } from "./useChat";
import { usePanelHistory } from "./usePanelHistory";
import { useFab } from "./useFab";

export interface AssistantProps {
  toolsets: readonly AssistantToolset[];
  /** The radio is playing: the button wears headphones */
  isMusicPlaying?: boolean;
}

export function Assistant(props: AssistantProps) {
  const setup = useAiSetup();
  if (!setup.isEnabled) return null;
  return <EnabledAssistant {...props} />;
}

function EnabledAssistant({ toolsets, isMusicPlaying }: AssistantProps) {
  const { t } = useTranslation("assistant");
  const setup = useAiSetup();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const toast = useToast();
  const section = sectionOf(pathname);
  const { isOpen, openPanel, closePanel } = usePanelHistory();
  const [hasUnread, setHasUnread] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [smartLog, setSmartLog] = useState<{
    Review: NonNullable<AssistantToolset["SmartLog"]>;
    text: string;
  } | null>(null);
  const openRef = useRef(isOpen);
  useEffect(() => {
    openRef.current = isOpen;
  });
  const onReply = useCallback(() => {
    if (!openRef.current) setHasUnread(true);
  }, []);
  const chat = useChat(toolsets, section, onReply);
  const [language] = useSetting("nt", "smartLogVoiceLang");
  const [isNutritionSmartLog] = useSetting("nt", "quickLogEnabled");
  const [shouldBeep] = useSetting("nt", "barcodeBeep");

  const open = () => {
    setHasUnread(false);
    openPanel();
  };
  const { refresh } = chat;
  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);
  useEffect(() => {
    // The clear dialog takes Escape for itself.
    if (!isOpen || isConfirmingClear) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, isConfirmingClear, closePanel]);

  const fab = useFab({
    canRecord: setup.isUsable && isNutritionSmartLog,
    shouldBeep,
    voiceLanguage: voiceLanguage(language),
    onTap: () => {
      if (isOpen) closePanel();
      else open();
    },
    onRecorded: (text) => {
      const toolset = toolsets.find((candidate) => candidate.id === section);
      if (toolset?.SmartLog) {
        setSmartLog({ Review: toolset.SmartLog, text });
        return;
      }
      open();
      void chat.send(text, { preamble: toolset?.smartLogPreamble });
    },
    onProblem: (problem) => {
      toast.error(t(`speech.${problem}`));
    },
  });

  const clear = () => {
    setIsConfirmingClear(false);
    chat.clear().catch((caught: unknown) => {
      toast.error(aiErrorText(caught));
    });
  };

  const label = t("open", { name: setup.assistantName });

  return (
    <>
      <div
        className="fixed z-40 touch-none select-none print:hidden"
        style={{
          right: fab.position.right,
          // The navigation bar stands the safe area higher, so the button does.
          bottom: `min(calc(${fab.position.bottom}px + env(safe-area-inset-bottom, 0px)), calc(100dvh - 3.5rem))`,
        }}
        {...fab.handlers}
      >
        <Badge count={hasUnread ? 1 : 0} label={t("unread")}>
          {/* TODO(monolithium): a floating action button. */}
          <Button
            variant={fab.recording ? "danger" : "primary"}
            className="size-12 rounded-full shadow-2xl"
            aria-label={label}
            aria-expanded={isOpen}
            onClick={fab.onClick}
          >
            {fab.recording ? (
              <Mic aria-hidden />
            ) : chat.isBusy ? (
              <Spinner size="sm" aria-hidden />
            ) : isMusicPlaying ? (
              <Headphones aria-hidden />
            ) : (
              <Sparkles aria-hidden />
            )}
          </Button>
        </Badge>
      </div>
      {fab.recording ? (
        <div
          role="status"
          className="fixed inset-x-4 top-4 z-40 mx-auto max-w-md rounded-container bg-level-2 p-3 shadow-2xl"
        >
          <Text variant="label">
            {t(fab.recording.willCancel ? "releaseToCancel" : "listening")}
          </Text>
          <Text>{fab.recording.text || "…"}</Text>
        </div>
      ) : null}
      {isOpen ? (
        <>
          {/* Behind the panel: a click beside it closes it. */}
          <div
            aria-hidden
            data-testid="assistant-backdrop"
            className="fixed inset-0 z-40 bg-black/40 print:hidden"
            onClick={closePanel}
          />
          <div className="pointer-events-none fixed inset-y-3 right-3 z-50 w-[28rem] max-w-[calc(100%-1.5rem)] print:hidden">
            <FloatingPanel
              side="right"
              isOpen
              compactAs="sheet"
              width="100%"
              title={setup.assistantName}
              className="pointer-events-auto inset-0"
              aria-label={setup.assistantName}
              aside={
                <Row gap={1}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("clear")}
                    isDisabled={!chat.messages.length || chat.isBusy}
                    onClick={() => {
                      setIsConfirmingClear(true);
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("close")}
                    onClick={closePanel}
                  >
                    <X aria-hidden />
                  </Button>
                </Row>
              }
              onClose={closePanel}
            >
              {setup.isUsable ? (
                <ChatPanel
                  chat={chat}
                  toolsets={toolsets}
                  voiceLanguage={voiceLanguage(language)}
                  onReplyAction={(toolset, text) => {
                    if (!toolset.SmartLog) return;
                    closePanel();
                    setSmartLog({ Review: toolset.SmartLog, text });
                  }}
                />
              ) : (
                <EmptyState
                  text={t("notSetUp")}
                  action={{
                    text: t("setUp"),
                    onClick: () => {
                      // Takes the panel's history entry: Back skips it.
                      void navigate("/settings/assistant", { replace: true });
                    },
                  }}
                />
              )}
            </FloatingPanel>
          </div>
        </>
      ) : null}
      {isConfirmingClear ? (
        <Dialog
          open
          variant="danger"
          title={t("clearTitle")}
          description={t("clearText")}
          cancelText={t("cancel")}
          confirmText={t("clear")}
          onOpenChange={(isNext) => {
            if (!isNext) setIsConfirmingClear(false);
          }}
          onConfirm={clear}
        />
      ) : null}
      {smartLog ? (
        <smartLog.Review
          text={smartLog.text}
          onClose={() => {
            setSmartLog(null);
          }}
        />
      ) : null}
    </>
  );
}
