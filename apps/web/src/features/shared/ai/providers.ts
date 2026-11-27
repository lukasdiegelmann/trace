/* eslint-disable @typescript-eslint/naming-convention -- the providers' fields */
/**
 * One JSON request per round, no streaming, tools run in the browser for at
 * most five rounds: the apps' src/lib/aiChat.js. Direct calls use the
 * user's key; when the server's environment configures AI, NutriTrace's
 * `/api/ai/chat` proxies them (CookTrace's proxy has no tools).
 */
import { api, ApiError } from "@/api";

import {
  DEFAULT_MODELS,
  geminiModel,
  readProvider,
  renamedModel,
} from "./models";
import { openAiBase, openAiParams } from "./openaiParams";
import {
  createToolSupportMemory,
  sendWithToolFallback,
  type OpenAiMessage,
} from "./toolSupport";
import {
  AiError,
  type AiConfig,
  type AiRequest,
  type AssistantTool,
  type ContentPart,
} from "./types";

export const MAX_ROUNDS = 5;
const OPENAI = "https://api.openai.com";

const toolSupport = createToolSupportMemory();

type Content = string | ContentPart[];

function splitDataUrl(url: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(url);
  return { mimeType: match?.[1] ?? "image/jpeg", data: match?.[2] ?? "" };
}

export function toClaudeContent(content: Content): unknown {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return part;
    const { mimeType, data } = splitDataUrl(part.dataUrl);
    return {
      type: mimeType === "application/pdf" ? "document" : "image",
      source: { type: "base64", media_type: mimeType, data },
    };
  });
}

export function toOpenAiContent(content: Content): unknown {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "text"
      ? part
      : { type: "image_url", image_url: { url: part.dataUrl } },
  );
}

export function toGeminiParts(content: Content): unknown[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((part) => {
    if (part.type === "text") return { text: part.text };
    const { mimeType, data } = splitDataUrl(part.dataUrl);
    return { inlineData: { mimeType, data } };
  });
}

/**
 * The browser's "Failed to fetch" says nothing: the address may be down, or
 * its answer may lack CORS headers. Say which host, and what to check.
 */
async function fetchProvider(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (caught) {
    if (
      !(caught instanceof TypeError) ||
      !/failed to fetch|networkerror|load failed/i.test(caught.message)
    ) {
      throw caught;
    }
    const host = URL.canParse(url) ? new URL(url).host : url;
    const isOfficial =
      /(^|\.)(openai\.com|anthropic\.com|googleapis\.com)$/i.test(host);
    const isInsecure =
      window.location.protocol === "https:" &&
      /^http:/i.test(url) &&
      !/^(localhost|127\.|\[::1\])/i.test(host);
    throw new AiError(
      isOfficial
        ? "unreachableOfficial"
        : isInsecure
          ? "unreachableInsecure"
          : "unreachable",
      host,
      { cause: caught },
    );
  }
}

interface ProviderError {
  error?: { message?: string };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ isOk: boolean; status: number; data: unknown }> {
  const response = await fetchProvider(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  const data: unknown = await response.json().catch(() => ({}));
  return { isOk: response.ok, status: response.status, data };
}

function failure(status: number, data: unknown): Error {
  return new Error(
    (data as ProviderError).error?.message || `AI error ${status}`,
  );
}

/** A tool's answer; a failure goes back to the model instead of ending */
async function runTool(
  request: AiRequest,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = request.tools?.find((candidate) => candidate.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  request.onToolCall?.(name);
  try {
    return (await tool.run(args)) ?? { ok: true };
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : "Tool failed",
    };
  }
}

function specs(tools: AssistantTool[] | undefined) {
  return (tools ?? []).map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

async function askClaude(config: AiConfig, request: AiRequest) {
  const tools = specs(request.tools).map(({ parameters, ...spec }) => ({
    ...spec,
    input_schema: parameters,
  }));
  const messages: { role: string; content: unknown }[] = request.messages.map(
    (message) => ({
      role: message.role,
      content: toClaudeContent(message.content),
    }),
  );
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const sent = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      {
        model: config.model || DEFAULT_MODELS.claude,
        max_tokens: 4096,
        system: request.systemPrompt,
        messages,
        ...(tools.length ? { tools } : {}),
      },
      request.signal,
    );
    if (!sent.isOk) throw failure(sent.status, sent.data);
    const data = sent.data as {
      stop_reason?: string;
      content?: {
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }[];
    };
    const blocks = data.content ?? [];
    const uses = blocks.filter((block) => block.type === "tool_use");
    if (!uses.length || data.stop_reason !== "tool_use") {
      return blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n");
    }
    messages.push({ role: "assistant", content: blocks });
    const results = [];
    for (const use of uses) {
      const result = await runTool(request, use.name ?? "", use.input ?? {});
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: results });
  }
  throw new AiError("tooManyRounds");
}

function parseArguments(text: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(text ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function openAiTools(tools: AssistantTool[] | undefined) {
  return specs(tools).map((spec) => ({ type: "function", function: spec }));
}

async function askOpenAi(
  config: AiConfig,
  request: AiRequest,
  baseUrl: string,
) {
  const tools = openAiTools(request.tools);
  const model = renamedModel(config.model || DEFAULT_MODELS.openai);
  const messages: OpenAiMessage[] = [
    { role: "system", content: request.systemPrompt },
    ...request.messages.map((message) => ({
      role: message.role,
      content: toOpenAiContent(message.content),
    })),
  ];
  // Ollama and friends refuse a placeholder key: only send a real one.
  const headers: Record<string, string> = config.apiKey
    ? { Authorization: `Bearer ${config.apiKey}` }
    : {};
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const sent = await sendWithToolFallback(
      {
        model,
        messages,
        ...openAiParams({ baseUrl, model, hasTools: tools.length > 0 }),
        ...(tools.length ? { tools } : {}),
      },
      (body) =>
        postJson(
          `${baseUrl}/v1/chat/completions`,
          headers,
          body,
          request.signal,
        ),
      { memory: toolSupport, baseUrl, model },
    );
    if (!sent.isOk) throw failure(sent.status, sent.data);
    if (sent.didDropTools) {
      request.onToolsUnsupported?.({ isRouted: sent.isRouted });
    }
    const message = (sent.data as { choices?: { message?: OpenAiMessage }[] })
      .choices?.[0]?.message;
    if (!message?.tool_calls?.length) {
      return typeof message?.content === "string" ? message.content : "";
    }
    messages.push(message);
    for (const call of message.tool_calls) {
      const result = await runTool(
        request,
        call.function?.name ?? "",
        parseArguments(call.function?.arguments),
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  throw new AiError("tooManyRounds");
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
}

async function askGemini(config: AiConfig, request: AiRequest) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel(config.model))}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const tools = specs(request.tools);
  const contents: { role: string; parts: unknown[] }[] = request.messages.map(
    (message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(message.content),
    }),
  );
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const sent = await postJson(
      url,
      {},
      {
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents,
        ...(tools.length ? { tools: [{ functionDeclarations: tools }] } : {}),
      },
      request.signal,
    );
    if (!sent.isOk) throw failure(sent.status, sent.data);
    const parts =
      (sent.data as { candidates?: { content?: { parts?: GeminiPart[] } }[] })
        .candidates?.[0]?.content?.parts ?? [];
    const calls = parts.flatMap((part) =>
      part.functionCall ? [part.functionCall] : [],
    );
    if (!calls.length) {
      return parts.flatMap((part) => (part.text ? [part.text] : [])).join("\n");
    }
    contents.push({ role: "model", parts });
    const responses = [];
    for (const call of calls) {
      const result = await runTool(request, call.name, call.args ?? {});
      responses.push({
        functionResponse: { name: call.name, response: result },
      });
    }
    contents.push({ role: "user", parts: responses });
  }
  throw new AiError("tooManyRounds");
}

interface ProxyReply {
  text?: string;
  toolsUnsupported?: boolean;
  toolsRouted?: boolean;
  assistantMessage?: unknown;
  toolCalls?: { id: string; name: string; args?: Record<string, unknown> }[];
}

/** Through NutriTrace, which holds the key; OpenAI's message shape */
async function askProxy(request: AiRequest): Promise<string> {
  const messages: unknown[] = request.messages.map((message) => ({
    role: message.role,
    content: toOpenAiContent(message.content),
  }));
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const data = await api.nt
      .post<ProxyReply>(
        "/ai/chat",
        {
          messages,
          systemPrompt: request.systemPrompt,
          tools: specs(request.tools),
        },
        { signal: request.signal },
      )
      .catch((caught: unknown) => {
        if (caught instanceof ApiError) throw new Error(caught.message);
        throw caught;
      });
    if (data.toolsUnsupported) {
      request.onToolsUnsupported?.({ isRouted: Boolean(data.toolsRouted) });
    }
    if (!data.toolCalls?.length) return data.text ?? "";
    messages.push(data.assistantMessage);
    for (const call of data.toolCalls) {
      const result = await runTool(request, call.name, call.args ?? {});
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        // The server's Gemini adapter needs the tool's name.
        name: call.name,
        content: JSON.stringify(result),
      });
    }
  }
  throw new AiError("tooManyRounds");
}

function askDirect(config: AiConfig, request: AiRequest): Promise<string> {
  // CookTrace calls the compatible provider "custom".
  const provider = readProvider(config.provider);
  if (provider === "oai-compat") {
    const base = openAiBase(config.baseUrl);
    if (!base) throw new AiError("missingBaseUrl");
    if (!config.model) throw new AiError("missingModel");
    return askOpenAi(config, request, base);
  }
  if (!config.apiKey) throw new AiError("missingKey");
  if (provider === "claude") return askClaude(config, request);
  if (provider === "gemini") return askGemini(config, request);
  return askOpenAi(config, request, OPENAI);
}

/** The reply's text, after any tool rounds */
export async function askAi(
  config: AiConfig,
  request: AiRequest,
  shouldUseProxy: boolean,
): Promise<string> {
  return shouldUseProxy ? askProxy(request) : askDirect(config, request);
}
