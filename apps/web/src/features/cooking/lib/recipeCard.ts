/**
 * A recipe as share images: one SVG page for a short recipe, up to six
 * for a long one, ported from cooktrace/src/lib/recipe-card.js. The card
 * is an image, not UI, so it carries its own colours like the original.
 */
import { cardFooter, clip, escapeXml } from "./shoppingCard";
import { formatStepText, type StepNode } from "./stepFormat";
import { formatDuration, totalMinutes, type RecipeTimes } from "./duration";

const W = 600;
const HERO_H = 380;
const TITLE_H = 140;
const CONTINUED_H = 70;
const SECTION_H = 56;
const ROW_H = 30;
const GROUP_H = 36;
const STEP_LINE_H = 24;
const STEP_GAP = 22;
const FOOTER_H = 70;
const PAD = 40;
/** About a phone screen; taller reads as a wall of text */
const MAX_PAGE_H = 1500;
export const MAX_PAGES = 6;
const STEP_CHARS = 56;
const STEP_MAX_LINES = 5;
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const ACCENT = "#4FFFB0";
const BACKGROUND = "#0A0B0F";
const LINE = "#1F2330";
const MUTED = "#A1A8B8";

export interface CardRecipe extends RecipeTimes {
  name?: string | null;
  img_url?: string | null;
  servings?: number | null;
  yield_text?: string | null;
  ingredients?: {
    name?: string;
    items?: { name?: string; qty?: string | null; unit?: string | null }[];
  }[];
  steps?: (string | { title?: string; text?: string })[];
}

/** The card's words, from the caller's i18n */
export interface CardTexts {
  untitled: string;
  ingredients: string;
  steps: string;
  continued: string;
  serves: (count: number) => string;
  page: (page: number, total: number) => string;
  more: (count: number) => string;
}

interface Block {
  kind: "section" | "row";
  height: number;
  render: (y: number) => string;
}

/** Words wrapped to `maxLines` lines of about `perLine` characters */
export function wrapText(
  text: string,
  perLine: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const [index, word] of words.entries()) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= perLine || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    if (lines.length === maxLines - 1) {
      line = words.slice(index).join(" ");
      break;
    }
    line = word;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const last = lines[maxLines - 1];
  if (lines.length === maxLines && last.length > perLine) {
    lines[maxLines - 1] = `${last.slice(0, perLine - 1).trimEnd()}…`;
  }
  return lines;
}

function text(
  x: number,
  y: number,
  content: string,
  attributes: string,
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" ${attributes}>${escapeXml(content)}</text>`;
}

function sectionBlock(title: string): Block {
  return {
    kind: "section",
    height: SECTION_H,
    render: (y) =>
      `${text(PAD, y + 36, title.toUpperCase(), `font-size="14" font-weight="800" letter-spacing="2" fill="${ACCENT}"`)}
      <line x1="${PAD}" y1="${y + 48}" x2="${W - PAD}" y2="${y + 48}" stroke="${LINE}" />`,
  };
}

function ingredientBlocks(recipe: CardRecipe, texts: CardTexts): Block[] {
  const groups = recipe.ingredients ?? [];
  const rows: Block[] = [];
  for (const group of groups) {
    const groupName = group.name;
    if (groupName && groups.length > 1) {
      rows.push({
        kind: "row",
        height: GROUP_H,
        render: (y) =>
          text(
            PAD,
            y + 24,
            clip(groupName, 40),
            `font-size="14" font-weight="700" font-style="italic" fill="${ACCENT}"`,
          ),
      });
    }
    for (const item of group.items ?? []) {
      const amount = [item.qty, item.unit].filter(Boolean).join(" ");
      const name = clip(item.name, amount ? 36 : 50);
      rows.push({
        kind: "row",
        height: ROW_H,
        render: (y) =>
          text(
            PAD,
            y + 22,
            `• ${name}`,
            `font-size="17" font-weight="500" fill="#FFFFFF"`,
          ) +
          (amount
            ? text(
                W - PAD,
                y + 22,
                amount,
                `text-anchor="end" font-size="16" font-weight="600" fill="${ACCENT}"`,
              )
            : ""),
      });
    }
  }
  return rows.length ? [sectionBlock(texts.ingredients), ...rows] : [];
}

/** Step text without its markers: the card has no bold or italics */
const plainText = (nodes: StepNode[]): string =>
  nodes
    .map((node) => (typeof node === "string" ? node : plainText(node.children)))
    .join("");

function stepBlocks(recipe: CardRecipe, texts: CardTexts): Block[] {
  const rows = (recipe.steps ?? []).map((step, index): Block => {
    const content =
      typeof step === "string"
        ? step
        : [step.title, step.text].filter(Boolean).join(": ");
    const lines = wrapText(
      plainText(formatStepText(content)),
      STEP_CHARS,
      STEP_MAX_LINES,
    );
    return {
      kind: "row",
      height: STEP_GAP + lines.length * STEP_LINE_H + 8,
      render: (y) => {
        const baseline = y + 24;
        return (
          `<circle cx="${PAD + 14}" cy="${baseline - 6}" r="14" fill="rgba(79,255,176,0.15)" stroke="${ACCENT}" stroke-width="1.5" />` +
          text(
            PAD + 14,
            baseline - 1,
            String(index + 1),
            `text-anchor="middle" font-size="13" font-weight="700" fill="${ACCENT}"`,
          ) +
          lines
            .map((line, i) =>
              text(
                PAD + 40,
                baseline + i * STEP_LINE_H,
                line,
                `font-size="16" font-weight="500" fill="#FFFFFF"`,
              ),
            )
            .join("")
        );
      },
    };
  });
  return rows.length ? [sectionBlock(texts.steps), ...rows] : [];
}

/** Greedy pages; a section header never ends a page */
function paginate(
  blocks: Block[],
  firstBudget: number,
  restBudget: number,
  texts: CardTexts,
): Block[][] {
  const pages: Block[][] = [];
  let page: Block[] = [];
  let used = 0;
  let budget = firstBudget;
  for (const [index, block] of blocks.entries()) {
    const needed =
      block.kind === "section"
        ? block.height + (blocks[index + 1]?.height ?? 0)
        : block.height;
    if (used + needed > budget && page.length) {
      if (pages.length + 1 >= MAX_PAGES) {
        const remaining = blocks.length - index;
        page.push({
          kind: "row",
          height: 36,
          render: (y) =>
            text(
              W / 2,
              y + 22,
              texts.more(remaining),
              `text-anchor="middle" font-size="14" font-style="italic" fill="${MUTED}"`,
            ),
        });
        break;
      }
      pages.push(page);
      page = [];
      used = 0;
      budget = restBudget;
    }
    page.push(block);
    used += block.height;
  }
  pages.push(page);
  return pages;
}

export interface CardPage {
  svg: string;
  width: number;
  height: number;
  page: number;
  total: number;
}

/** The pages as SVG; `hero` is the recipe's image as a data URL */
export function buildRecipeCardPages(
  recipe: CardRecipe,
  texts: CardTexts,
  hero: string | null,
): CardPage[] {
  const name = recipe.name || texts.untitled;
  const total = totalMinutes(recipe);
  const subtitle = [
    total ? formatDuration(total) : null,
    recipe.servings ? texts.serves(recipe.servings) : null,
    recipe.yield_text || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const pages = paginate(
    [...ingredientBlocks(recipe, texts), ...stepBlocks(recipe, texts)],
    MAX_PAGE_H - HERO_H - TITLE_H - FOOTER_H,
    MAX_PAGE_H - CONTINUED_H - FOOTER_H,
    texts,
  );
  return pages.map((blocks, index) => {
    const isFirst = index === 0;
    const headHeight = isFirst ? HERO_H + TITLE_H : CONTINUED_H;
    const height =
      headHeight +
      blocks.reduce((sum, block) => sum + block.height, 0) +
      FOOTER_H;
    let head: string;
    if (isFirst) {
      const image = hero
        ? `<image href="${escapeXml(hero)}" x="0" y="0" width="${W}" height="${HERO_H}" preserveAspectRatio="xMidYMid slice" />
           <rect x="0" y="${HERO_H - 80}" width="${W}" height="80" fill="url(#heroGrad)" />`
        : `<rect width="${W}" height="${HERO_H}" fill="#11141B" />
           <text x="${W / 2}" y="${HERO_H / 2 + 30}" font-size="80" text-anchor="middle">🍳</text>`;
      // Up to three title lines; the subtitle follows the last one.
      const titleLines = wrapText(name, 24, 3);
      const title = titleLines
        .map((line, i) =>
          text(
            PAD,
            HERO_H + 44 + i * 32,
            line,
            `font-size="30" font-weight="800" fill="#FFFFFF"`,
          ),
        )
        .join("");
      head =
        image +
        `<rect x="0" y="${HERO_H}" width="${W}" height="${TITLE_H}" fill="${BACKGROUND}" />` +
        title +
        (subtitle
          ? text(
              PAD,
              HERO_H + 44 + (titleLines.length - 1) * 32 + 28,
              subtitle,
              `font-size="18" fill="${MUTED}"`,
            )
          : "");
    } else {
      head =
        text(
          PAD,
          42,
          `${clip(name, 28)} · ${texts.continued}`,
          `font-size="22" font-weight="800" fill="#FFFFFF"`,
        ) +
        `<line x1="${PAD}" y1="${CONTINUED_H - 10}" x2="${W - PAD}" y2="${CONTINUED_H - 10}" stroke="${LINE}" />`;
    }
    let cursor = headHeight;
    const body = blocks
      .map((block) => {
        const svg = block.render(cursor);
        cursor += block.height;
        return svg;
      })
      .join("");
    const footer =
      `<line x1="${PAD}" y1="${height - FOOTER_H + 14}" x2="${W - PAD}" y2="${height - FOOTER_H + 14}" stroke="${LINE}" />` +
      (pages.length > 1
        ? text(
            W / 2,
            height - FOOTER_H + 34,
            texts.page(index + 1, pages.length),
            `text-anchor="middle" font-size="11" font-weight="700" letter-spacing="3" fill="${MUTED}"`,
          )
        : "") +
      cardFooter(W / 2, height - 16);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
<defs><linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgb(10,11,15)" stop-opacity="0" /><stop offset="100%" stop-color="rgb(10,11,15)" /></linearGradient></defs>
<rect width="${W}" height="${height}" fill="${BACKGROUND}" />
${head}${body}${footer}
</svg>`;
    return { svg, width: W, height, page: index + 1, total: pages.length };
  });
}

/** "Mom's Pasta!" as "mom-s-pasta" (plus the page, if several) */
export function cardFilename(name: string, page = 1, total = 1): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "recipe";
  return total > 1 ? `${slug}-page-${page}-of-${total}.png` : `${slug}.png`;
}
