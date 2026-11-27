/**
 * Providers and models, from NutriTrace's and LiftTrace's src/lib/aiChat.js
 * (checked against the vendors' pages on 2026-10-09; CookTrace's list was
 * older). Labels compare list prices within each provider.
 */
export const AI_PROVIDERS = [
  "claude",
  "openai",
  "gemini",
  "oai-compat",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_NAMES: Record<AiProvider, string> = {
  claude: "Anthropic Claude",
  openai: "OpenAI",
  gemini: "Google Gemini",
  "oai-compat": "OpenAI compatible",
};

export const CUSTOM_MODEL = "__custom__";

export const AI_MODELS: Record<
  Exclude<AiProvider, "oai-compat">,
  { value: string; label: string }[]
> = {
  claude: [
    { value: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { value: "claude-opus-5-5", label: "Claude Opus 5.5" },
    { value: "claude-fable-5-1", label: "Claude Fable 5.1" },
    { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { value: "claude-opus-5", label: "Claude Opus 5" },
    { value: "claude-fable-5", label: "Claude Fable 5" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
  ],
  // GPT-6.1 Sol and GPT-6 Astra have no tools on Chat Completions.
  openai: [
    { value: "gpt-6-luna", label: "GPT-6 Luna" },
    { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4o", label: "GPT-4o" },
  ],
  gemini: [
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
    { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  ],
};

export const DEFAULT_MODELS: Record<
  Exclude<AiProvider, "oai-compat">,
  string
> = {
  claude: "claude-haiku-5-5",
  openai: "gpt-5.6-luna",
  gemini: "gemini-3.8-flash",
};

const RENAMES: Partial<Record<string, string>> = {
  "gemini-3.1-pro": "gemini-3.1-pro-preview",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
  "gpt-5.6": "gpt-5.6-sol",
};

export function renamedModel(model: string): string {
  return RENAMES[model] ?? model;
}

/** Models Google has shut down: a saved one is answered by the default */
const RETIRED_GEMINI = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-2.0-flash-lite-preview",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.5-pro-preview-03-25",
  "gemini-2.5-pro-preview-05-06",
  "gemini-2.5-pro-preview-06-05",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-flash-preview-09-25",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-3.1-flash-lite-preview",
]);

export function geminiModel(model: string): string {
  const name = renamedModel(model || DEFAULT_MODELS.gemini);
  return RETIRED_GEMINI.has(name) ? DEFAULT_MODELS.gemini : name;
}

export function readProvider(value: unknown): AiProvider {
  if (value === "custom") return "oai-compat";
  return AI_PROVIDERS.find((provider) => provider === value) ?? "claude";
}
