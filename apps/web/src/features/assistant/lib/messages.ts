/**
 * The conversation: one history for all of Trace, kept by NutriTrace
 * (`/api/ai/history`, the newest 100 turns). Pictures aren't stored.
 */
import { api } from "@/api";
import type { ChatTurn, ContentPart } from "@/features/shared/ai";

export interface ChatMessage {
  id: string;
  /** "note" is for the person only and never sent to the model */
  role: "user" | "assistant" | "note";
  text: string;
  images?: string[];
  isError?: boolean;
  time: number;
}

export const SENT_MESSAGES = 20;
/** The newest turns NutriTrace keeps */
export const HISTORY_LIMIT = 100;
export const IMAGE_PLACEHOLDER = "(image attached)";
export const IMAGE_ONLY_PROMPT = "Please look at this.";

interface HistoryRow {
  id?: number;
  role: string;
  content: unknown;
  created_at?: string;
}

let counter = 0;
export function messageId(): string {
  counter += 1;
  return `m${Date.now()}-${counter}`;
}

/** SQLite's UTC "YYYY-MM-DD HH:MM:SS" has no zone */
export function historyTime(value: string | undefined): number {
  if (!value) return Date.now();
  const time = Date.parse(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
  return Number.isNaN(time) ? Date.now() : time;
}

/** The time of day; for an earlier day the date too (Trace.svelte) */
export function messageTime(
  time: number,
  now: number,
  language: string,
): string {
  const isToday =
    new Date(time).toDateString() === new Date(now).toDateString();
  return new Intl.DateTimeFormat(language, {
    ...(isToday ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

export function fromHistory(rows: readonly HistoryRow[]): ChatMessage[] {
  return rows.flatMap((row, index) =>
    (row.role === "user" || row.role === "assistant") &&
    typeof row.content === "string"
      ? [
          {
            id: `h${row.id ?? index}`,
            role: row.role,
            text: row.content,
            time: historyTime(row.created_at),
          },
        ]
      : [],
  );
}

/**
 * Whether the server's history says nothing new: then what is on screen
 * stays, with the pictures, notes and errors the server doesn't keep.
 */
export function isSameConversation(
  shown: readonly ChatMessage[],
  history: readonly ChatMessage[],
): boolean {
  const kept = shown.filter(
    (message) => message.role !== "note" && !message.isError,
  );
  const isCut = history.length >= HISTORY_LIMIT;
  if (kept.length < history.length) return false;
  if (!isCut && kept.length !== history.length) return false;
  const tail = kept.slice(kept.length - history.length);
  return history.every((row, index) => {
    const message = tail[index];
    const text = message.images?.length
      ? `${message.text} ${IMAGE_PLACEHOLDER}`.trim()
      : message.text;
    return message.role === row.role && text === row.text;
  });
}

export async function loadHistory(): Promise<ChatMessage[]> {
  return fromHistory(await api.nt.get<HistoryRow[]>("/ai/history"));
}

/** Best effort: a conversation that couldn't be saved still goes on */
export async function saveHistory(
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  try {
    await api.nt.post("/ai/history", { role, content });
  } catch {
    // The reply is on screen; only the next visit misses it.
  }
}

export function clearHistory(): Promise<unknown> {
  return api.nt.delete("/ai/history");
}

/**
 * What the model is sent: the last turns without notes and errors, the
 * newest with its pictures and, for Smart Log by voice, a preamble.
 */
export function toTurns(
  messages: readonly ChatMessage[],
  preamble = "",
): ChatTurn[] {
  const sent = messages
    .filter((message) => message.role !== "note" && !message.isError)
    .slice(-SENT_MESSAGES);
  // Providers want the conversation to open with the user.
  while (sent[0] && sent[0].role !== "user") sent.shift();
  return sent.map((message, index) => {
    const isLast = index === sent.length - 1;
    const role = message.role as "user" | "assistant";
    const images = isLast ? (message.images ?? []) : [];
    const text =
      isLast && preamble ? `${preamble}\n${message.text}` : message.text;
    if (!images.length) return { role, content: text || IMAGE_PLACEHOLDER };
    const parts: ContentPart[] = [
      ...images.map((dataUrl) => ({ type: "image" as const, dataUrl })),
      { type: "text", text: text || IMAGE_ONLY_PROMPT },
    ];
    return { role, content: parts };
  });
}
