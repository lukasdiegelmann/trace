/**
 * The contract of the Trace assistant. Each domain feature (nutrition,
 * cooking, training) exports one `AssistantToolset` from its own
 * `assistant/` folder; the app shell hands them to the assistant. The AI
 * client in this folder is also used on its own, e.g. to read a label.
 */
import type { ComponentType } from "react";

/** A JSON Schema, as the providers take it for a tool's arguments */
export type JsonSchema = Record<string, unknown>;

export interface ToolSpec {
  /** Unique across all toolsets */
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface AssistantTool extends ToolSpec {
  /** The result goes back to the model as JSON; a throw becomes `{ error }` */
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

/** One choice a card asks for, e.g. the meal to log into */
export interface CardSelect {
  label: string;
  options: { value: string; label: string }[];
  initial: string;
}

export interface CardAction {
  id: string;
  text: string;
  isPrimary?: boolean;
  /** Offered only while the select's value passes */
  isEnabled?: (selected: string) => boolean;
  /** Saves; resolves to the line the card then shows */
  run: (selected: string) => Promise<string>;
}

/** A proposal the user confirms: nothing is saved until an action runs */
export interface AssistantCard {
  /** Cards of one kind replace each other, e.g. "nutrition:food" */
  kind: string;
  title: string;
  rows: [label: string, value: string][];
  select?: CardSelect;
  /** Discard is added by the assistant */
  actions: CardAction[];
}

/** What a toolset may know about the turn it offers tools for */
export interface TurnContext {
  /** A photo is attached to this message */
  hasImage: boolean;
  /** A card of this kind still waits for the user */
  hasPendingCard: (kind: string) => boolean;
  addCard: (card: AssistantCard) => void;
}

export interface SmartLogProps {
  /** What the user said (or typed) */
  text: string;
  /** Closes the review, saved or not */
  onClose: () => void;
}

export type ToolsetId = "nutrition" | "cooking" | "training";

export interface AssistantToolset {
  id: ToolsetId;
  /** The tools of one turn, with texts for cards in the current language */
  tools: (turn: TurnContext) => AssistantTool[] | Promise<AssistantTool[]>;
  /**
   * This domain's part of the system prompt, in English: its units, the
   * data the model should know without asking, rules for its tools. A
   * rejection leaves the part out.
   */
  context: () => Promise<string>;
  /** Welcome chips, translated; each is sent as it reads */
  suggestions: () => string[];
  /**
   * Smart Log: the review of what was said, opened by holding the assistant
   * button in this domain's section. Without it the text goes to the chat,
   * after `smartLogPreamble`.
   */
  SmartLog?: ComponentType<SmartLogProps>;
  smartLogPreamble?: string;
  /** An extra button under a reply, e.g. "Use this workout" */
  replyAction?: (reply: string) => { label: string; text: string } | null;
}

/** An image as a data URL, or text; the shape of a user turn */
export type ContentPart =
  { type: "text"; text: string } | { type: "image"; dataUrl: string };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

export interface AiConfig {
  /** claude | openai | gemini | oai-compat (CookTrace calls it custom) */
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface AiRequest {
  messages: ChatTurn[];
  systemPrompt: string;
  tools?: AssistantTool[];
  onToolCall?: (name: string) => void;
  /** The model can't use tools and answered without them */
  onToolsUnsupported?: (info: { isRouted: boolean }) => void;
  signal?: AbortSignal;
}

export type AiProblem =
  | "missingKey"
  | "missingBaseUrl"
  | "missingModel"
  | "unknownProvider"
  | "tooManyRounds"
  | "unreachable"
  | "unreachableInsecure"
  | "unreachableOfficial";

/** A failure the UI says in its own language; others carry the provider's */
export class AiError extends Error {
  readonly problem: AiProblem;
  readonly host?: string;

  constructor(problem: AiProblem, host?: string, options?: ErrorOptions) {
    super(host ? `${problem}: ${host}` : problem, options);
    this.name = "AiError";
    this.problem = problem;
    this.host = host;
  }
}
