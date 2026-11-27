import { Button } from "@monocircuit/monolithium/components";
import { Play } from "lucide-react";
import { createElement, Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { splitWithTimes } from "../../lib/parseTimes";
import { formatStepText, type StepNode } from "../../lib/stepFormat";
import { formatRemaining } from "../../timers/timers";

function render(node: StepNode, key: number): ReactNode {
  if (typeof node === "string") return <Fragment key={key}>{node}</Fragment>;
  return createElement(node.mark, { key }, node.children.map(render));
}

/** A step's text with its marks; each duration in it starts a timer */
export function StepText({
  text,
  onTimer,
}: {
  text: string;
  onTimer: (durationSec: number) => void;
}) {
  const { t } = useTranslation("cooking");
  // A div: the timer buttons are blocks, which a <p> may not hold.
  return (
    <div className="whitespace-pre-line">
      {splitWithTimes(text).map((part, index) =>
        part.type === "text" ? (
          <Fragment key={index}>
            {formatStepText(part.value).map(render)}
          </Fragment>
        ) : (
          <span key={index} className="mx-0.5 inline-block align-middle">
            <Button
              variant="secondary"
              size="sm"
              text={part.value}
              aria-label={t("recipeView.startTimer", {
                time: formatRemaining(part.durationSec * 1000),
                text: part.value,
              })}
              onClick={() => {
                onTimer(part.durationSec);
              }}
            >
              <Play aria-hidden size={14} />
            </Button>
          </span>
        ),
      )}
    </div>
  );
}
