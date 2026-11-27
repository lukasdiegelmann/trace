/**
 * Models that can't use tools on OpenAI-compatible endpoints, ported from
 * the apps' src/lib/tool-support.js (TraceApps/nutritrace#259): when a
 * refusal says so, the request goes once more without tools, and the model
 * counts as tool-less for a short while.
 */
type Json = Record<string, unknown>;

const TOOL_WORDS =
  "(?:tools?|tool use|tool calls?|tool calling|tool messages|functions?|function calls?|function calling)";

/** Refusals real servers send; each names tools, so no other 400 matches */
const REFUSALS = [
  /tool_use_not_supported/,
  new RegExp(
    `\\b${TOOL_WORDS}\\W{0,3}\\s+(?:is|are)\\s+not\\s+(?:supported|enabled|available)\\b`,
  ),
  new RegExp(`\\bdoes\\s+not\\s+support\\s+${TOOL_WORDS}\\b`),
  /does not support parameters:[^\]]*\btools\b/,
  /unrecognized request arguments? supplied:[^.]*\btools\b/,
  /tool choice requires --enable-auto-tool-choice/,
  /no endpoints found that support tool use/,
  /extra_forbidden['"]?\s*,\s*['"]loc['"]\s*:\s*[([]\s*['"]body['"]\s*,\s*['"]tools['"]/,
];
/** Certain enough to trust with a 5xx too (llama.cpp answers 500) */
const REFUSALS_5XX = [
  /tool_use_not_supported/,
  /\bdoes\s+not\s+support\s+tools\b/,
  /tools param requires --jinja/,
];
const NAMED_MODEL = [
  /provided model:\s*([^\s"'\\,;)}\]]+)/,
  /for model=([^\s"'\\,;)}\]]+?)\.?(?=[\s"'\\,;)}\]]|$)/,
  new RegExp(`([\\w.:/@-]+)\\s+does\\s+not\\s+support\\s+${TOOL_WORDS}\\b`),
];
/** A validation error repeats the request: the user's words are left out */
const ECHOES = [
  /input_value=(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\[[^\]]*\]|\{[^}]*\}|[^,\]]*)/g,
  /\\?['"]input\\?['"]\s*:\s*(?:\\?'(?:[^'\\]|\\.)*?\\?'|\\?"(?:[^"\\]|\\.)*?\\?"|\[[^\]]*\]|\{[^}]*\}|[^,}\]]*)/g,
];

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

function errorTexts(body: unknown): string[] {
  const texts: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === "string" && value) texts.push(value);
  };
  const object = asObject(body);
  if (typeof body === "string") add(body);
  else if (object) {
    const error = object.error;
    if (typeof error === "string") add(error);
    const nested = asObject(error);
    if (nested) {
      add(nested.message);
      add(nested.code);
      add(nested.type);
    }
    add(object.message);
    add(object.error_type);
    add(object.code);
    if (typeof object.detail === "string") add(object.detail);
    else if (Array.isArray(object.detail)) {
      for (const detail of object.detail) add(asObject(detail)?.msg);
    }
    if (!texts.length) add(JSON.stringify(body));
  }
  return texts.map((text) =>
    ECHOES.reduce(
      (cleaned, echo) => cleaned.replace(echo, ""),
      text.toLowerCase(),
    ),
  );
}

/** pydantic as JSON: {"detail":[{"type":"extra_forbidden","loc":["body","tools"]}]} */
function isToolsForbidden(body: unknown): boolean {
  const detail = asObject(body)?.detail;
  return (
    Array.isArray(detail) &&
    detail.some((entry) => {
      const object = asObject(entry);
      return (
        Array.isArray(object?.loc) &&
        object.loc.includes("tools") &&
        /^(?:extra_forbidden|value_error\.extra)$/.test(String(object.type))
      );
    })
  );
}

/** Null unless the failed response says the model can't use tools */
export function toolsRefusal(
  status: number,
  body: unknown,
): { model: string | null } | null {
  const isServerError = status >= 500 && status <= 599;
  if (![400, 404, 422].includes(status) && !isServerError) return null;
  const texts = errorTexts(body);
  const error = asObject(asObject(body)?.error);
  const isRefusal = isServerError
    ? texts.some((text) => REFUSALS_5XX.some((re) => re.test(text)))
    : (error?.param === "tools" &&
        [error.code, error.type].some(
          (value) => typeof value === "string" && /unsupported/.test(value),
        )) ||
      isToolsForbidden(body) ||
      texts.some((text) => REFUSALS.some((re) => re.test(text)));
  if (!isRefusal) return null;
  for (const text of texts) {
    for (const pattern of NAMED_MODEL) {
      const name = pattern.exec(text)?.[1];
      // "This model does not support tools" names no model.
      if (name && /[\d:/._-]/.test(name)) return { model: name };
    }
  }
  return { model: null };
}

/** Ollama names "registry.ollama.ai/library/gemma3:latest" for "gemma3" */
function modelKey(model: string): string {
  return (model.toLowerCase().split("/").pop() ?? "").replace(/:latest$/, "");
}

/** A gateway that routes one name to many models refused for one of them */
export function isOtherModel(named: string | null, asked: string): boolean {
  return Boolean(named && asked && modelKey(named) !== modelKey(asked));
}

export const TOOLLESS_TTL_MS = 5 * 60_000;
const TOOLLESS_MAX = 32;

export function createToolSupportMemory({
  ttlMs = TOOLLESS_TTL_MS,
  max = TOOLLESS_MAX,
  now = () => Date.now(),
} = {}) {
  const until = new Map<string, number>();
  const key = (baseUrl: string, model: string) =>
    `${baseUrl.replace(/\/+$/, "")} ${model}`;
  return {
    remember(baseUrl: string, model: string) {
      const id = key(baseUrl, model);
      until.delete(id);
      until.set(id, now() + ttlMs);
      while (until.size > max) {
        until.delete(until.keys().next().value as string);
      }
    },
    isToolless(baseUrl: string, model: string) {
      const id = key(baseUrl, model);
      const expiry = until.get(id);
      if (expiry === undefined) return false;
      if (expiry > now()) return true;
      until.delete(id);
      return false;
    },
  };
}

export interface OpenAiMessage {
  role: string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id?: string;
    function?: { name?: string; arguments?: string };
  }[];
}

/** Earlier tool rounds as plain text, for a model that is sent no tools */
export function withoutToolHistory(messages: OpenAiMessage[]): OpenAiMessage[] {
  if (!messages.some((m) => m.role === "tool" || m.tool_calls?.length)) {
    return messages;
  }
  const names = new Map<string, string>();
  const out: OpenAiMessage[] = [];
  let results: OpenAiMessage | null = null;
  for (const message of messages) {
    if (message.role === "assistant" && message.tool_calls?.length) {
      const lines: string[] = [];
      if (typeof message.content === "string" && message.content) {
        lines.push(message.content);
      }
      for (const call of message.tool_calls) {
        const name = call.function?.name;
        if (call.id && name) names.set(call.id, name);
        lines.push(
          `[Called ${name ?? "a tool"} with ${call.function?.arguments || "{}"}]`,
        );
      }
      out.push({ role: "assistant", content: lines.join("\n") });
      results = null;
    } else if (message.role === "tool") {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content ?? null);
      const name =
        message.name ?? names.get(message.tool_call_id ?? "") ?? "a tool";
      const line = `[Result of ${name}: ${content}]`;
      if (results) results.content = `${String(results.content)}\n${line}`;
      else {
        results = { role: "user", content: line };
        out.push(results);
      }
    } else {
      out.push(message);
      results = null;
    }
  }
  return out;
}

/** Without tools a model could claim it logged what never happened */
export const NO_TOOLS_NOTE =
  "No tools are available for this request: don't say you logged, saved, changed or looked anything up; answer from what's above.";

function withNoToolsNote(messages: OpenAiMessage[]): OpenAiMessage[] {
  const index = messages.findIndex((m) => m.role === "system");
  if (index < 0) {
    return [{ role: "system", content: NO_TOOLS_NOTE }, ...messages];
  }
  return messages.map((message, i) =>
    i === index
      ? {
          ...message,
          content:
            typeof message.content === "string" && message.content
              ? `${message.content}\n\n${NO_TOOLS_NOTE}`
              : NO_TOOLS_NOTE,
        }
      : message,
  );
}

export function withoutTools(body: Json): Json {
  const rest = { ...body };
  delete rest.tools;
  delete rest.tool_choice;
  delete rest.parallel_tool_calls;
  return {
    ...rest,
    messages: withNoToolsNote(
      withoutToolHistory(rest.messages as OpenAiMessage[]),
    ),
  };
}

export interface Sent {
  isOk: boolean;
  status: number;
  data: unknown;
}

export async function sendWithToolFallback(
  body: Json,
  send: (body: Json) => Promise<Sent>,
  {
    memory,
    baseUrl,
    model,
  }: {
    memory: ReturnType<typeof createToolSupportMemory>;
    baseUrl: string;
    model: string;
  },
): Promise<Sent & { didDropTools: boolean; isRouted: boolean }> {
  const done = (sent: Sent, didDropTools = false, isRouted = false) => ({
    ...sent,
    didDropTools,
    isRouted,
  });
  if (!Array.isArray(body.tools) || body.tools.length === 0) {
    return done(await send(body));
  }
  if (memory.isToolless(baseUrl, model)) {
    return done(await send(withoutTools(body)), true);
  }
  const first = await send(body);
  const refusal = first.isOk ? null : toolsRefusal(first.status, first.data);
  if (!refusal) return done(first);
  const isRouted = isOtherModel(refusal.model, model);
  const second = await send(withoutTools(body));
  if (second.isOk && !isRouted) memory.remember(baseUrl, model);
  return done(second, true, isRouted);
}
