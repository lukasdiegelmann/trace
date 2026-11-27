import { createElement, Fragment, type ReactNode } from "react";

import { isPlainText, parseRichText, type RichNode } from "../../lib/richText";

function render(node: RichNode, key: number): ReactNode {
  if (typeof node === "string") return <Fragment key={key}>{node}</Fragment>;
  if (node.tag === "br") return <br key={key} />;
  return createElement(
    node.tag,
    {
      key,
      style: node.color ? { color: node.color } : undefined,
      className:
        node.tag === "ul"
          ? "list-disc pl-5"
          : node.tag === "ol"
            ? "list-decimal pl-5"
            : undefined,
    },
    node.children.map(render),
  );
}

/** Stored notes and comments, as elements (never innerHTML) */
export function RichText({ html }: { html: string }) {
  return (
    <div
      className={`text-body break-words ${isPlainText(html) ? "whitespace-pre-line" : ""}`}
    >
      {parseRichText(html).map(render)}
    </div>
  );
}
