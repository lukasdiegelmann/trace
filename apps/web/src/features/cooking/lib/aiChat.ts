/**
 * One question to the configured AI, with or without a photo, and "Scan
 * Label" on top of it. Ported from cooktrace/src/lib/{aiChat,scan-nutrition}.js
 * without tool use. Direct calls use the user's key; when the server sets AI
 * up through env, `/ct/api/ai/chat` is the proxy. A shared Trace AI client
 * may replace this (decision in issue #6).
 */
import { api } from "@/api";
import {
  DEFAULT_MODELS,
  geminiModel,
  renamedModel,
} from "@/features/shared/ai";

import { NUTRIMENTS, type Nutrition } from "./nutriments";

export interface AiImage {
  /** Base64 without the data-URL prefix */
  base64: string;
  mimeType: string;
}

export interface AiQuestion {
  systemPrompt: string;
  prompt: string;
  /** A photo; with the type "application/pdf" a document (claude, gemini) */
  image?: AiImage;
  /** For long answers, e.g. every recipe of a cookbook; direct calls only */
  maxTokens?: number;
}

export interface AiConfig {
  /** `aiProvider`: claude, openai, gemini, oai-compat (or custom) */
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const SYSTEM_PROMPT = "You are a nutrition label parser. Return JSON only.";

const LABEL_PROMPT = [
  "Extract nutrition facts from this label image.",
  "Return ONLY a JSON object with these keys (omit keys you cannot read):",
  "  name (string, product name), brand (string), portion (number), unit (string, one of g/ml/oz/fl oz/cup/tsp/tbsp/lb/kg/l/each),",
  "  per_serving (boolean, true if the listed values are per serving, false if per 100g),",
  "  calories (kcal), kilojoules (kJ),",
  "  fat (g), saturated-fat (g), trans-fat (g), polyunsaturated-fat (g), monounsaturated-fat (g),",
  "  carbohydrates (g), sugars (g), added-sugars (g), fiber (g),",
  "  proteins (g),",
  "  sodium (mg), salt (g), potassium (mg), cholesterol (mg),",
  "  calcium (mg), iron (mg), magnesium (mg), zinc (mg), phosphorus (mg),",
  "  vitamin-d (µg), vitamin-a (µg), vitamin-c (mg), vitamin-e (mg), vitamin-k (µg),",
  "  b1 (mg), b2 (mg), b3 (mg), b6 (mg), b9 (µg), b12 (µg),",
  "  caffeine (mg), alcohol (g)",
  "Use numbers, not strings. Use the units specified, not the label's.",
  "No commentary, no markdown — JSON only.",
].join("\n");

/** An image file as base64 */
export async function readImage(file: Blob): Promise<AiImage> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("Could not read the photo"));
    };
    reader.readAsDataURL(file);
  });
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match?.[1] || !match[2]) throw new Error("Could not read the photo");
  return { mimeType: match[1], base64: match[2] };
}

/** The JSON object in the reply, fences and prose aside; else null */
export function parseJsonReply(reply: string): Record<string, unknown> | null {
  const cleaned = reply
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const candidates = [cleaned, /\{[\s\S]*\}/.exec(cleaned)?.[0]];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

interface AiReply {
  error?: { message?: string };
  content?: { type?: string; text?: string }[];
  choices?: { message?: { content?: string } }[];
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<AiReply> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as AiReply;
  if (!response.ok) {
    throw new Error(data.error?.message || `AI error ${response.status}`);
  }
  return data;
}

function openAiContent({ prompt, image }: AiQuestion) {
  if (!image) return prompt;
  return [
    {
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    },
    { type: "text", text: prompt },
  ];
}

async function askProvider(
  config: AiConfig,
  question: AiQuestion,
): Promise<string> {
  const { image, prompt, systemPrompt, maxTokens = 4096 } = question;
  const provider = config.provider || "claude";
  const isCompatible = provider === "oai-compat" || provider === "custom";
  if (!config.apiKey && !isCompatible) throw new Error("missing-api-key");
  if (provider === "claude") {
    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      {
        model: renamedModel(config.model || DEFAULT_MODELS.claude),
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              ...(image
                ? [
                    {
                      type:
                        image.mimeType === "application/pdf"
                          ? "document"
                          : "image",
                      source: {
                        type: "base64",
                        media_type: image.mimeType,
                        data: image.base64,
                      },
                    },
                  ]
                : []),
              { type: "text", text: prompt },
            ],
          },
        ],
      },
    );
    return (data.content ?? []).map((part) => part.text ?? "").join("\n");
  }
  if (provider === "gemini") {
    const model = encodeURIComponent(geminiModel(config.model));
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {},
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              ...(image
                ? [
                    {
                      inlineData: {
                        mimeType: image.mimeType,
                        data: image.base64,
                      },
                    },
                  ]
                : []),
              { text: prompt },
            ],
          },
        ],
      },
    );
    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n");
  }
  if (provider !== "openai" && !isCompatible) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  if (isCompatible && (!config.baseUrl || !config.model)) {
    throw new Error("missing-base-url");
  }
  const base = isCompatible
    ? config.baseUrl.replace(/\/+$/, "")
    : "https://api.openai.com";
  const data = await postJson(
    `${base}/v1/chat/completions`,
    config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    {
      model: renamedModel(config.model || DEFAULT_MODELS.openai),
      stream: false,
      // OpenAI's own API takes max_completion_tokens; most compatible
      // gateways still only know max_tokens.
      ...(isCompatible
        ? { max_tokens: maxTokens }
        : { max_completion_tokens: maxTokens }),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: openAiContent(question) },
      ],
    },
  );
  return data.choices?.[0]?.message?.content ?? "";
}

async function askProxy(question: AiQuestion): Promise<string> {
  const data = await api.ct.post<{ text?: string; content?: string }>(
    "/ai/chat",
    {
      systemPrompt: question.systemPrompt,
      messages: [{ role: "user", content: openAiContent(question) }],
    },
  );
  return data.text || data.content || "";
}

/** The reply's text; `shouldUseProxy` when env sets AI up on the server */
export function askAi(
  config: AiConfig,
  question: AiQuestion,
  shouldUseProxy: boolean,
): Promise<string> {
  return shouldUseProxy ? askProxy(question) : askProvider(config, question);
}

/** Photo -> prompt -> parsed JSON, or null when the reply had none */
export async function scanNutritionLabel(
  image: AiImage,
  config: AiConfig,
  shouldUseProxy: boolean,
): Promise<Record<string, unknown> | null> {
  const reply = await askAi(
    config,
    { systemPrompt: SYSTEM_PROMPT, prompt: LABEL_PROMPT, image },
    shouldUseProxy,
  );
  return parseJsonReply(reply);
}

export interface LabelFields {
  name?: string;
  brand?: string;
  serving_size?: number;
  serving_unit?: string;
  nutrition: Nutrition;
}

/** What the label read overwrites (it is the source of truth right then) */
export function labelFields(parsed: Record<string, unknown>): LabelFields {
  const fields: LabelFields = { nutrition: {} };
  const asText = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const asNumber = (value: unknown) => {
    const number =
      typeof value === "number" ? value : Number.parseFloat(asText(value));
    return Number.isFinite(number) ? number : undefined;
  };
  if (asText(parsed.name)) fields.name = asText(parsed.name);
  if (asText(parsed.brand)) fields.brand = asText(parsed.brand);
  const portion = asNumber(parsed.portion);
  if (portion !== undefined) fields.serving_size = portion;
  if (asText(parsed.unit)) fields.serving_unit = asText(parsed.unit);
  for (const nutriment of NUTRIMENTS) {
    const value = asNumber(parsed[nutriment.id]);
    if (value !== undefined) fields.nutrition[nutriment.id] = value;
  }
  return fields;
}
