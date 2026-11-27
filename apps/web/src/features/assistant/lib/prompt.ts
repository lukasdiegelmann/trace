/** The system prompt: who the assistant is, then each domain's part */
import type { AssistantToolset, ToolsetId } from "@/features/shared/ai";

export interface PromptContext {
  assistantName: string;
  now: Date;
  /** The UI's language, e.g. "de" */
  language: string;
  /** The section on screen, if it is one of the three */
  section: ToolsetId | null;
}

export function personaPrompt({
  assistantName,
  now,
  language,
  section,
}: PromptContext): string {
  const date = now.toLocaleDateString("sv-SE");
  const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(
    now,
  );
  const time = now.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    `You are ${assistantName}, the assistant in Trace, an app for nutrition (NutriTrace), cooking (CookTrace) and training (LiftTrace).`,
    `Today is ${weekday}, ${date}, ${time} on the user's device.`,
    `Answer in the language the user writes in; the app is set to "${language}".`,
    "Keep answers short and practical. Simple Markdown (lists, bold) is fine; no tables or headings.",
    "Use the tools to look up data instead of guessing. Never say you logged, saved or changed something unless a tool did it.",
    ...(section
      ? [`The user is looking at the ${section} section of the app.`]
      : []),
  ].join("\n");
}

/** A domain that can't say anything right now is left out */
export async function systemPrompt(
  toolsets: readonly AssistantToolset[],
  context: PromptContext,
): Promise<string> {
  const parts = await Promise.allSettled(
    toolsets.map((toolset) => toolset.context()),
  );
  return [
    personaPrompt(context),
    ...parts.flatMap((part, index) =>
      part.status === "fulfilled" && part.value.trim()
        ? [`## ${toolsets[index]?.id ?? ""}\n${part.value.trim()}`]
        : [],
    ),
  ].join("\n\n");
}

export function sectionOf(pathname: string): ToolsetId | null {
  const first = pathname.split("/")[1];
  return first === "nutrition" || first === "cooking" || first === "training"
    ? first
    : null;
}
