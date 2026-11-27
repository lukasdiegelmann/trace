import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";

import { parseJsonReply } from "./json";
import { geminiModel, readProvider } from "./models";
import { openAiBase, openAiParams } from "./openaiParams";
import { askAi } from "./providers";
import { aiSetup, loadAiSetup } from "./setup";
import {
  createToolSupportMemory,
  toolsRefusal,
  withoutToolHistory,
} from "./toolSupport";
import type { AiRequest, AssistantTool } from "./types";

function replies(...bodies: [number, unknown][]) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      sent.push({
        url,
        body: JSON.parse(init.body as string) as Record<string, unknown>,
      });
      const [status, body] = bodies[sent.length - 1] ?? [500, {}];
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }),
  );
  return sent;
}

const echo: AssistantTool = {
  name: "echo",
  description: "Echo",
  parameters: { type: "object", properties: {} },
  run: (args) => Promise.resolve({ said: args.text }),
};

const request: AiRequest = {
  systemPrompt: "sys",
  messages: [{ role: "user", content: "hi" }],
  tools: [echo],
};

const config = { provider: "claude", apiKey: "k", model: "", baseUrl: "" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAi", () => {
  it("runs Claude's tool calls and returns the final text", async () => {
    const sent = replies(
      [
        200,
        {
          stop_reason: "tool_use",
          content: [
            { type: "tool_use", id: "1", name: "echo", input: { text: "a" } },
          ],
        },
      ],
      [200, { content: [{ type: "text", text: "done" }] }],
    );
    await expect(askAi(config, request, false)).resolves.toBe("done");
    expect(sent[0]?.body).toMatchObject({
      model: "claude-haiku-5-5",
      system: "sys",
      tools: [{ name: "echo", input_schema: echo.parameters }],
    });
    expect(JSON.stringify(sent[1]?.body.messages)).toContain(
      '"content":"{\\"said\\":\\"a\\"}"',
    );
  });

  it("retries an OpenAI-compatible model without tools", async () => {
    const sent = replies(
      [400, { error: { message: "gemma3 does not support tools" } }],
      [200, { choices: [{ message: { content: "plain" } }] }],
    );
    const onToolsUnsupported = vi.fn();
    await expect(
      askAi(
        {
          provider: "custom",
          apiKey: "",
          model: "gemma3",
          baseUrl: "http://localhost:11434/v1",
        },
        { ...request, onToolsUnsupported },
        false,
      ),
    ).resolves.toBe("plain");
    expect(sent[0]?.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(sent[1]?.body.tools).toBeUndefined();
    expect(onToolsUnsupported).toHaveBeenCalledWith({ isRouted: false });
  });

  it("runs Gemini's function calls", async () => {
    const sent = replies(
      [
        200,
        {
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: "echo", args: { text: 1 } } }],
              },
            },
          ],
        },
      ],
      [200, { candidates: [{ content: { parts: [{ text: "ok" }] } }] }],
    );
    await expect(
      askAi({ ...config, provider: "gemini" }, request, false),
    ).resolves.toBe("ok");
    expect(JSON.stringify(sent[1]?.body)).toContain("functionResponse");
  });

  it("gives up after five rounds and reports a tool's failure", async () => {
    const call: [number, unknown] = [
      200,
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "1", name: "nope", input: {} }],
      },
    ];
    const sent = replies(call, call, call, call, call);
    await expect(askAi(config, request, false)).rejects.toMatchObject({
      problem: "tooManyRounds",
    });
    expect(JSON.stringify(sent[4]?.body)).toContain("Unknown tool: nope");
  });

  it("uses NutriTrace's proxy when the server configures AI", async () => {
    const post = vi
      .spyOn(api.nt, "post")
      .mockResolvedValueOnce({
        assistantMessage: { role: "assistant" },
        toolCalls: [{ id: "c", name: "echo", args: { text: "x" } }],
      })
      .mockResolvedValueOnce({ text: "via proxy" });
    await expect(askAi(config, request, true)).resolves.toBe("via proxy");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("says what is missing", async () => {
    await expect(
      askAi({ ...config, apiKey: "" }, request, false),
    ).rejects.toMatchObject({ problem: "missingKey" });
    await expect(
      askAi({ ...config, provider: "oai-compat" }, request, false),
    ).rejects.toMatchObject({ problem: "missingBaseUrl" });
  });
});

describe("loadAiSetup", () => {
  it("survives an empty answer about the server's locks", async () => {
    vi.spyOn(api.nt, "get").mockImplementation((path) =>
      Promise.resolve((path === "/settings" ? {} : null) as never),
    );
    await expect(loadAiSetup()).resolves.toMatchObject({
      isEnabled: false,
      shouldUseProxy: false,
    });
  });
});

describe("setup", () => {
  it("is usable with a key, a keyless endpoint or the server's config", () => {
    expect(aiSetup({ aiEnabled: true }, {}).isUsable).toBe(false);
    expect(aiSetup({ aiEnabled: true, aiApiKey: "k" }, {}).isUsable).toBe(true);
    expect(
      aiSetup(
        { aiEnabled: true, aiProvider: "custom", aiBaseUrl: "http://x" },
        {},
      ).isUsable,
    ).toBe(true);
    expect(aiSetup({}, { ai: true, ai_enabled: true })).toMatchObject({
      isEnabled: true,
      isUsable: true,
      shouldUseProxy: true,
    });
    expect(aiSetup({ aiApiKey: "k" }, {}).isUsable).toBe(false);
  });
});

describe("helpers", () => {
  it("maps providers and models", () => {
    expect(readProvider("custom")).toBe("oai-compat");
    expect(readProvider("?")).toBe("claude");
    expect(geminiModel("gemini-2.0-flash")).toBe("gemini-3.8-flash");
    expect(geminiModel("gemini-3.1-pro")).toBe("gemini-3.1-pro-preview");
  });

  it("builds OpenAI parameters per endpoint", () => {
    expect(openAiBase(" http://x/v1/chat/completions/ ")).toBe("http://x");
    expect(
      openAiParams({
        baseUrl: "https://api.openai.com",
        model: "gpt-5.6-luna",
        hasTools: true,
      }),
    ).toMatchObject({ reasoning_effort: "none", max_completion_tokens: 4096 });
    expect(
      openAiParams({ baseUrl: "http://x", model: "m", hasTools: true }),
    ).toEqual({ stream: false, max_tokens: 4096 });
  });

  it("reads JSON out of a chatty reply", () => {
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonReply('Here: {"a":2} done')).toEqual({ a: 2 });
    expect(parseJsonReply("no")).toBeNull();
  });

  it("recognises refusals and rewrites tool history", () => {
    expect(
      toolsRefusal(400, {
        error: { param: "tools", code: "unsupported_parameter" },
      }),
    ).toEqual({ model: null });
    expect(toolsRefusal(400, { error: { message: "bad request" } })).toBeNull();
    expect(toolsRefusal(500, "tools param requires --jinja")).not.toBeNull();
    expect(
      withoutToolHistory([
        {
          role: "assistant",
          tool_calls: [{ id: "1", function: { name: "f" } }],
        },
        { role: "tool", tool_call_id: "1", content: "x" },
      ]).map((m) => m.content),
    ).toEqual(["[Called f with {}]", "[Result of f: x]"]);
    let now = 0;
    const memory = createToolSupportMemory({ ttlMs: 10, now: () => now });
    memory.remember("http://x/", "m");
    expect(memory.isToolless("http://x", "m")).toBe(true);
    now = 11;
    expect(memory.isToolless("http://x", "m")).toBe(false);
  });
});
