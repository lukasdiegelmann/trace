/**
 * The HTML of recipe notes and comments, reduced to what the old editor
 * can write (cooktrace/src/components/ui/RichTextEditor.svelte). Unlike
 * the original it also checks the children of a tag it unwraps: there,
 * `<x><img onerror=…></x>` came through. The result is a plain tree, so
 * nothing is ever rendered with innerHTML.
 */
export type RichTag =
  | "b"
  | "strong"
  | "i"
  | "em"
  | "u"
  | "s"
  | "strike"
  | "del"
  | "ul"
  | "ol"
  | "li"
  | "p"
  | "br"
  | "div"
  | "span";

export type RichNode =
  string | { tag: RichTag; color?: string; children: RichNode[] };

const ALLOWED: ReadonlySet<string> = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "ul",
  "ol",
  "li",
  "p",
  "br",
  "div",
  "span",
  "font",
]);
/** Their text is code, not content: dropped with everything inside */
const DROPPED: ReadonlySet<string> = new Set([
  "script",
  "style",
  "template",
  "iframe",
  "object",
  "noscript",
]);
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function colorOf(element: Element, tag: string): string | undefined {
  const raw =
    tag === "font"
      ? (element.getAttribute("color") ?? "")
      : (/(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(
          element.getAttribute("style") ?? "",
        )?.[1] ?? "");
  const value = raw.trim();
  if (HEX_COLOR.test(value)) return value;
  // Browsers rewrite style colours to rgb().
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value);
  if (!rgb) return undefined;
  const hex = rgb
    .slice(1)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

function walk(node: Node): RichNode[] {
  const result: RichNode[] = [];
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      result.push(child.textContent ?? "");
      continue;
    }
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    const name = element.tagName.toLowerCase();
    if (DROPPED.has(name)) continue;
    const children = walk(element);
    if (!ALLOWED.has(name)) {
      result.push(...children);
      continue;
    }
    if (name === "font" || name === "span") {
      const color = colorOf(element, name);
      if (color) result.push({ tag: "span", color, children });
      else result.push(...children);
      continue;
    }
    result.push({ tag: name as RichTag, children });
  }
  return result;
}

function textOf(nodes: readonly RichNode[]): string {
  return nodes
    .map((node) => (typeof node === "string" ? node : textOf(node.children)))
    .join("");
}

/** The allowed part of `html` as a tree; empty when there is no text */
export function parseRichText(html: string | null | undefined): RichNode[] {
  if (!html) return [];
  // An inert document: nothing in it loads or runs while parsing.
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const nodes = walk(parsed.body);
  return textOf(nodes).trim() ? nodes : [];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serialise(nodes: readonly RichNode[]): string {
  return nodes
    .map((node) => {
      if (typeof node === "string") return escapeHtml(node);
      if (node.tag === "br") return "<br>";
      const style = node.color ? ` style="color: ${node.color}"` : "";
      return `<${node.tag}${style}>${serialise(node.children)}</${node.tag}>`;
    })
    .join("");
}

export function sanitizeRichText(html: string | null | undefined): string {
  return serialise(parseRichText(html));
}

/*
 * monolithium has no rich text editor, so notes and comments are edited as
 * text with markers and stored as the HTML the old editor writes.
 * TODO(monolithium): RichTextEditor (bold, italic, underline, strike,
 * colour, lists).
 */

/** Inline markers; a marker only counts when it hugs its text */
const INLINE_MARKS: readonly (readonly [RichTag, string])[] = [
  ["strong", "**"],
  ["u", "__"],
  ["s", "~~"],
  ["em", "*"],
];

const MARK_OF_TAG: Partial<Record<RichTag, string>> = {
  b: "**",
  strong: "**",
  u: "__",
  s: "~~",
  strike: "~~",
  del: "~~",
  i: "*",
  em: "*",
};

function toMarkup(nodes: readonly RichNode[]): string {
  let out = "";
  const startLine = () => {
    if (out && !out.endsWith("\n")) out += "\n";
  };
  for (const node of nodes) {
    if (typeof node === "string") {
      out += node;
      continue;
    }
    if (node.tag === "br") {
      out += "\n";
      continue;
    }
    if (node.tag === "ul" || node.tag === "ol") {
      startLine();
      let number = 0;
      for (const item of node.children) {
        if (typeof item === "string") continue;
        number++;
        const bullet = node.tag === "ol" ? `${number}. ` : "- ";
        out += `${bullet}${toMarkup(item.children).trim()}\n`;
      }
      continue;
    }
    const inner = toMarkup(node.children);
    if (node.tag === "p" || node.tag === "div") {
      startLine();
      out += `${inner.replace(/\n$/, "")}\n`;
      continue;
    }
    if (node.color) {
      out += `[${inner}]{${node.color}}`;
      continue;
    }
    const mark = MARK_OF_TAG[node.tag];
    // Spaces stay outside the markers, or they would not be read back.
    const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    out +=
      mark && parts?.[2]
        ? `${parts[1]}${mark}${parts[2]}${mark}${parts[3]}`
        : inner;
  }
  return out;
}

/** The stored HTML (or plain text) as editable text */
export function richTextToMarkup(html: string | null | undefined): string {
  return toMarkup(parseRichText(html)).replace(/\n+$/, "");
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function inlineToHtml(text: string): string {
  const colour = /\[([^\]]+)\]\{(#(?:[0-9a-fA-F]{3}){1,2})\}/;
  const found = colour.exec(text);
  if (found) {
    return (
      inlineToHtml(text.slice(0, found.index)) +
      `<span style="color: ${found[2]}">${inlineToHtml(found[1])}</span>` +
      inlineToHtml(text.slice(found.index + found[0].length))
    );
  }
  for (const [tag, mark] of INLINE_MARKS) {
    const m = escapeRegExp(mark);
    const marked = new RegExp(`${m}(?=\\S)([\\s\\S]*?\\S)${m}`).exec(text);
    if (marked) {
      return (
        inlineToHtml(text.slice(0, marked.index)) +
        `<${tag}>${inlineToHtml(marked[1])}</${tag}>` +
        inlineToHtml(text.slice(marked.index + marked[0].length))
      );
    }
  }
  return escapeHtml(text);
}

/** Editable text back to the HTML the old UI displays */
export function markupToRichText(markup: string): string {
  const text = markup.trim();
  if (!text) return "";
  let html = "";
  let list: "ul" | "ol" | null = null;
  let hasLine = false;
  const closeList = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*(?:[-•]|(\d+)\.)\s+(.*)$/.exec(line);
    if (bullet) {
      const kind = bullet[1] ? "ol" : "ul";
      if (list !== kind) {
        closeList();
        html += `<${kind}>`;
        list = kind;
      }
      html += `<li>${inlineToHtml(bullet[2])}</li>`;
      hasLine = false;
      continue;
    }
    closeList();
    if (hasLine) html += "<br>";
    html += inlineToHtml(line);
    hasLine = true;
  }
  closeList();
  return html;
}

/** True for notes that are plain text (imports), whose line breaks count */
export function isPlainText(value: string): boolean {
  return !/<\/?[a-z][^>]*>/i.test(value);
}
