/**
 * A confirmation and an action sheet that answer with a promise, as the old
 * UI's `confirmDialog` and `ActionSheet` did, on monolithium's Dialog, Sheet
 * and ActionList.
 */
import { ActionList, Dialog, Sheet } from "@monocircuit/monolithium/components";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface ConfirmOptions {
  title: string;
  text: string;
  confirmText: string;
  cancelText?: string;
  isDanger?: boolean;
}

export interface Choice {
  id: string;
  text: string;
  description?: string;
  isDanger?: boolean;
}

/** One question at a time; a closed or replaced one answers `null` */
function useQuestion<Q, A>() {
  const [question, setQuestion] = useState<Q | null>(null);
  const resolver = useRef<((answer: A | null) => void) | null>(null);
  const answer = useCallback((value: A | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setQuestion(null);
  }, []);
  const ask = useCallback((next: Q) => {
    resolver.current?.(null);
    return new Promise<A | null>((resolve) => {
      resolver.current = resolve;
      setQuestion(next);
    });
  }, []);
  return { question, ask, answer };
}

export function useConfirm() {
  const { t } = useTranslation("training");
  const { question, ask, answer } = useQuestion<ConfirmOptions, boolean>();
  const confirm = useCallback(
    async (options: ConfirmOptions) => (await ask(options)) === true,
    [ask],
  );
  const dialog = (
    <Dialog
      open={question !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) answer(false);
      }}
      title={question?.title ?? ""}
      description={question?.text}
      cancelText={question?.cancelText ?? t("diary.confirm.cancel")}
      confirmText={question?.confirmText ?? ""}
      variant={question?.isDanger === false ? "default" : "danger"}
      onConfirm={() => {
        answer(true);
      }}
    />
  );
  return { confirm, dialog };
}

export function useChoice() {
  const { question, ask, answer } = useQuestion<
    { title: string; actions: Choice[] },
    string
  >();
  const sheet = (
    <Sheet
      isOpen={question !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) answer(null);
      }}
      title={question?.title ?? ""}
    >
      <ActionList
        label={question?.title ?? ""}
        items={(question?.actions ?? []).map((action) => ({
          id: action.id,
          text: action.text,
          description: action.description,
          tone: action.isDanger ? ("danger" as const) : ("default" as const),
          onSelect: () => {
            answer(action.id);
          },
        }))}
      />
    </Sheet>
  );
  return { choose: ask, sheet };
}
