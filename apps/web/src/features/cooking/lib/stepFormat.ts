/**
 * The three inline markers of step text (`**bold**`, `*italic*`,
 * `__underline__`), ported from cooktrace/src/lib/step-format.js. Instead
 * of escaped HTML it returns a tree, which React renders without
 * innerHTML.
 */
export type StepMark = "strong" | "em" | "u";

export type StepNode = string | { mark: StepMark; children: StepNode[] };

/** In the original's order: bold first, so "**" is not read as italics */
const RULES: readonly (readonly [StepMark, RegExp])[] = [
  ["strong", /\*\*([^*\n]+)\*\*/],
  ["em", /\*([^*\n]+)\*/],
  ["u", /__([^_\n]+)__/],
];

export function formatStepText(text: string, ruleIndex = 0): StepNode[] {
  if (!text) return [];
  if (ruleIndex >= RULES.length) return [text];
  const [mark, pattern] = RULES[ruleIndex];
  const found = pattern.exec(text);
  if (!found) return formatStepText(text, ruleIndex + 1);
  return [
    ...formatStepText(text.slice(0, found.index), ruleIndex + 1),
    { mark, children: formatStepText(found[1], ruleIndex + 1) },
    ...formatStepText(text.slice(found.index + found[0].length), ruleIndex),
  ];
}
