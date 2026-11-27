/**
 * What the formatting buttons do to a text and its selection
 * (cooktrace/src/components/ui/MarkdownToolbar.svelte).
 */
export interface Selection {
  text: string;
  start: number;
  end: number;
}

/** Wraps the selection in markers, or takes them off if it has them */
export function wrapSelection(
  { text, start, end }: Selection,
  left: string,
  right: string = left,
): Selection {
  const selected = text.slice(start, end);
  if (
    selected.length >= left.length + right.length &&
    selected.startsWith(left) &&
    selected.endsWith(right)
  ) {
    const inner = selected.slice(left.length, -right.length);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }
  return {
    text: text.slice(0, start) + left + selected + right + text.slice(end),
    start: start + left.length,
    end: end + left.length,
  };
}

/** Makes the selected lines a bulleted or numbered list */
export function prefixLines(
  { text, start, end }: Selection,
  isOrdered: boolean,
): Selection {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const found = text.indexOf("\n", end);
  const to = found === -1 ? text.length : found;
  const block = text
    .slice(from, to)
    .split("\n")
    .map((line, index) => {
      if (!line.trim()) return line;
      return `${isOrdered ? `${index + 1}. ` : "- "}${line}`;
    })
    .join("\n");
  return {
    text: text.slice(0, from) + block + text.slice(to),
    start: from,
    end: from + block.length,
  };
}
