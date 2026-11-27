/** Ported from the apps' src/lib/openai-chat-params.js */
const OPENAI_ORIGIN = "https://api.openai.com";
const REASONING_NONE_MODELS = /^(?:gpt-5\.6|gpt-6-luna)(?:-|$)/;

/** A base URL without trailing slash, "/v1" or "/chat/completions" */
export function openAiBase(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/v1$/i, "");
}

/**
 * The token and reasoning parameters an endpoint takes. Only OpenAI's own
 * knows `max_completion_tokens`; `stream: false` is said because some
 * gateways stream otherwise.
 */
export function openAiParams({
  baseUrl,
  model,
  hasTools,
  maxTokens = 4096,
}: {
  baseUrl: string;
  model: string;
  hasTools: boolean;
  maxTokens?: number;
}): Record<string, unknown> {
  if (openAiBase(baseUrl) !== OPENAI_ORIGIN) {
    return { stream: false, max_tokens: maxTokens };
  }
  return {
    stream: false,
    max_completion_tokens: maxTokens,
    // These need reasoning "none" while function tools are offered.
    ...(hasTools && REASONING_NONE_MODELS.test(model)
      ? { reasoning_effort: "none" }
      : {}),
  };
}
