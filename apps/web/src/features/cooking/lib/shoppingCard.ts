/**
 * Share cards and the share sheet, ported from
 * cooktrace/src/lib/shopping-card.js. The card is an image (SVG rasterised
 * to PNG), not UI, so it carries its own fixed colours like the original;
 * the footer reads "TRACE" instead of the CookTrace mark. Texts come from
 * the caller (i18n).
 */

const W = 600;
const HEAD_H = 160;
const FOOT_H = 70;
const ROW_H = 44;
const PAD_X = 40;
const MAX_ROWS = 32;
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const ACCENT = "#4FFFB0";
const BACKGROUND = "#0A0B0F";
const LINE = "#1F2330";
const MUTED = "#A1A8B8";

/** What a card or text list shows of a shopping row */
export interface ShareableItem {
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
  checked?: boolean | number | null;
}

export interface ShoppingShareTexts {
  /** "Shopping List" */
  title: string;
  /** "3 items" (text list header) */
  itemCount: (count: number) => string;
  /** "3 ITEMS" (card pill) */
  itemCountShort: (count: number) => string;
  /** "+4 more…" */
  more: (count: number) => string;
  /** The text list's signature line, e.g. "— Trace" */
  signature: string;
  /** The date line */
  date: string;
}

/** XML-escape for SVG text */
export function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Cut to roughly `chars` characters with an ellipsis */
export function clip(value: string | null | undefined, chars: number): string {
  if (!value) return "";
  return value.length > chars
    ? `${value.slice(0, chars - 1).trimEnd()}…`
    : value;
}

function quantityText(item: ShareableItem): string {
  const quantity =
    item.quantity != null && item.quantity !== "" ? String(item.quantity) : "";
  return [quantity, item.unit ?? ""].filter(Boolean).join(" ");
}

/** The unchecked rows, or all when none is left (never a blank card) */
export function itemsToBuy<T extends ShareableItem>(items: readonly T[]): T[] {
  const toBuy = items.filter((item) => !item.checked);
  return toBuy.length > 0 ? toBuy : [...items];
}

/** The "TRACE" wordmark centred on `centerX` (shared by share cards) */
export function cardFooter(centerX: number, baseline: number): string {
  return `<text x="${centerX}" y="${baseline}" text-anchor="middle" font-family="${FONT}"
    font-size="13" font-weight="800" letter-spacing="3" fill="${ACCENT}">TRACE</text>`;
}

/** The shopping card as SVG: header, one row per item, "+N more" */
export function buildShoppingCardSvg(
  items: readonly ShareableItem[],
  texts: ShoppingShareTexts,
): { svg: string; width: number; height: number } {
  const toBuy = itemsToBuy(items);
  const total = toBuy.length;
  const hasOverflow = total > MAX_ROWS;
  const shown = hasOverflow ? toBuy.slice(0, MAX_ROWS - 1) : toBuy;
  const bodyRows = shown.length + (hasOverflow ? 1 : 0);
  const bodyH = Math.max(ROW_H, bodyRows * ROW_H + 20);
  const H = HEAD_H + bodyH + FOOT_H;

  const header = `
    <g>
      <g transform="translate(${PAD_X}, 44)" stroke="${ACCENT}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="0" y="6" width="48" height="60" rx="6" />
        <rect x="14" y="-2" width="20" height="14" rx="3" fill="${ACCENT}" stroke="none" />
        <line x1="12" y1="28" x2="36" y2="28" />
        <line x1="12" y1="40" x2="36" y2="40" />
        <line x1="12" y1="52" x2="28" y2="52" />
      </g>
      <text x="${PAD_X + 70}" y="68" font-family="${FONT}" font-size="32" font-weight="800" fill="#FFFFFF">${escapeXml(clip(texts.title, 22))}</text>
      <text x="${PAD_X + 70}" y="98" font-family="${FONT}" font-size="16" fill="${MUTED}">${escapeXml(texts.date)}</text>
      <g transform="translate(${W - PAD_X - 110}, 38)">
        <rect width="110" height="32" rx="16" fill="rgba(79,255,176,0.14)" stroke="${ACCENT}" stroke-width="1.5" />
        <text x="55" y="21" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="${ACCENT}">${escapeXml(texts.itemCountShort(total))}</text>
      </g>
      <line x1="${PAD_X}" y1="${HEAD_H - 18}" x2="${W - PAD_X}" y2="${HEAD_H - 18}" stroke="${LINE}" stroke-width="1" />
    </g>`;

  let body = "";
  shown.forEach((item, index) => {
    const y = HEAD_H + 8 + index * ROW_H + ROW_H / 2;
    const baseline = y + 7;
    const qty = quantityText(item);
    const name = clip(item.name, qty ? 30 : 40);
    const hasLine = index < shown.length - 1 || hasOverflow;
    body += `
      <g>
        <rect x="${PAD_X}" y="${y - 12}" width="22" height="22" rx="4" fill="none" stroke="${ACCENT}" stroke-width="2" />
        <text x="${PAD_X + 36}" y="${baseline}" font-family="${FONT}" font-size="20" font-weight="600" fill="#FFFFFF">${escapeXml(name)}</text>
        ${qty ? `<text x="${W - PAD_X}" y="${baseline}" text-anchor="end" font-family="${FONT}" font-size="18" font-weight="600" fill="${ACCENT}">${escapeXml(qty)}</text>` : ""}
        ${hasLine ? `<line x1="${PAD_X + 36}" y1="${y + ROW_H / 2 - 1}" x2="${W - PAD_X}" y2="${y + ROW_H / 2 - 1}" stroke="${LINE}" stroke-width="1" />` : ""}
      </g>`;
  });
  if (hasOverflow) {
    const y = HEAD_H + 8 + shown.length * ROW_H + ROW_H / 2;
    body += `
      <text x="${W / 2}" y="${y + 7}" text-anchor="middle" font-family="${FONT}" font-size="16" font-style="italic" fill="${MUTED}">${escapeXml(texts.more(total - shown.length))}</text>`;
  }

  const footer = `
    <line x1="${PAD_X}" y1="${H - FOOT_H + 12}" x2="${W - PAD_X}" y2="${H - FOOT_H + 12}" stroke="${LINE}" stroke-width="1" />
    ${cardFooter(W / 2, H - 24)}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BACKGROUND}" />
  ${header}
  ${body}
  ${footer}
</svg>`;
  return { svg, width: W, height: H };
}

/** The plain-text list for SMS, mail or notes */
export function buildShoppingText(
  items: readonly ShareableItem[],
  texts: ShoppingShareTexts,
): string {
  const toBuy = itemsToBuy(items);
  const lines = [
    `🛒 ${texts.title} (${texts.itemCount(toBuy.length)})`,
    texts.date,
    "",
  ];
  for (const item of toBuy) {
    const qty = quantityText(item);
    lines.push(`• ${item.name}${qty ? ` — ${qty}` : ""}`);
  }
  lines.push("", texts.signature);
  return lines.join("\n");
}

/** SVG string → PNG blob at 2× density */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const url = `data:image/svg+xml;base64,${btoa(binary)}`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => {
      resolve();
    };
    image.onerror = () => {
      reject(new Error("Could not load card image"));
    };
    image.src = url;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export interface ShareResult {
  isShared: boolean;
  isCanceled?: boolean;
  isDownloaded?: boolean;
  isCopied?: boolean;
  count?: number;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  // An anchor is the only way to name a download; it is never rendered.
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

/** Web Share with the file, else a download */
export async function shareBlob(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
): Promise<ShareResult> {
  return shareBlobs([{ blob, filename }], title, text);
}

/** Several files (pages of a card): share them all, else download each */
export async function shareBlobs(
  parts: readonly { blob: Blob; filename: string }[],
  title: string,
  text?: string,
): Promise<ShareResult> {
  if (parts.length === 0) return { isShared: false };
  const files = parts.map(
    (part) => new File([part.blob], part.filename, { type: part.blob.type }),
  );
  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  ) {
    try {
      await navigator.share({ files, title, text });
      return { isShared: true };
    } catch (error) {
      if (isAbort(error)) return { isShared: false, isCanceled: true };
    }
  }
  for (const [index, part] of parts.entries()) {
    download(part.blob, part.filename);
    // Browsers throttle several downloads from one gesture.
    if (index < parts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  return { isShared: false, isDownloaded: true, count: parts.length };
}

/** Web Share with text, else the clipboard */
export async function shareText(
  text: string,
  title: string,
): Promise<ShareResult> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return { isShared: true };
    } catch (error) {
      if (isAbort(error)) return { isShared: false, isCanceled: true };
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { isShared: false, isCopied: true };
  } catch {
    return { isShared: false };
  }
}
