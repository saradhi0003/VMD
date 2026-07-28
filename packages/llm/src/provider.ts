import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL_AGENT, MODEL_FAST } from "./index.js";

/* ──────────────────────────────────────────────────────────
   Provider adapter.

   One seam under every LLM call in this package. Two backends:

     • "openai-compat" — any OpenAI-compatible /v1 server. Built for a
       vLLM instance running on a free Google Colab T4 (see
       infra/colab/), but works with anything speaking that API.
     • "anthropic"     — the hosted Claude API (costs money).

   Both return the model's answer as a JSON *string* in `.text`, so
   callers parse identically regardless of backend. On the
   openai-compat path a JSON Schema constrains decoding, so invalid
   JSON is impossible; on the Anthropic path the schema is sent as a
   single forced tool, which is what daily-agent.ts already did.
─────────────────────────────────────────────────────────── */

export type Provider = "openai-compat" | "anthropic" | "none";

/** Default model for the Colab server — one 7B VLM covers both vision and text roles. */
const DEFAULT_OSS_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct-AWQ";

/** A free T4 takes 30-90s on a full-page scan, so the ceiling is generous. */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Which backend to use. `LLM_PROVIDER` forces a choice; otherwise a configured
 * `LLM_BASE_URL` wins over `ANTHROPIC_API_KEY` (self-hosted is free, so prefer it).
 * `"none"` means callers fall back to their offline behaviour — never an error.
 */
export function activeProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit === "openai-compat") return process.env.LLM_BASE_URL ? "openai-compat" : "none";
  if (explicit === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : "none";
  if (process.env.LLM_BASE_URL) return "openai-compat";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

export interface ChatRequest {
  system?: string;
  user: string;
  image?: { base64: string; mediaType: string };
  maxTokens: number;
  /** Pick the cheap/fast model rather than the reasoning one. */
  fast?: boolean;
  /** Constrains the response to this shape. Name is used as the tool name on Anthropic. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export interface ChatResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  raw: unknown;
}

function modelFor(provider: Provider, fast: boolean): string {
  if (provider === "openai-compat") {
    const configured = fast ? process.env.LLM_MODEL_FAST : process.env.LLM_MODEL_AGENT;
    return configured || DEFAULT_OSS_MODEL;
  }
  return fast ? MODEL_FAST : MODEL_AGENT;
}

function timeoutMs(): number {
  const raw = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * Single-shot chat completion returning JSON text.
 * Throws on transport/HTTP errors — every caller wraps this in try/catch and degrades.
 */
export async function chatJson(req: ChatRequest): Promise<ChatResponse> {
  const provider = activeProvider();
  if (provider === "none") throw new Error("chatJson: no LLM provider configured");
  return provider === "openai-compat" ? callOpenAICompat(req) : callAnthropic(req);
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI-compatible (vLLM on Colab, or any /v1 server)
// ─────────────────────────────────────────────────────────────────────────

interface OpenAICompletion {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

async function callOpenAICompat(req: ChatRequest): Promise<ChatResponse> {
  const base = (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, "");
  const model = modelFor("openai-compat", Boolean(req.fast));

  // Image first, text second — same block order the Anthropic calls used.
  const content = req.image
    ? [
        {
          type: "image_url",
          image_url: { url: `data:${req.image.mediaType};base64,${req.image.base64}` },
        },
        { type: "text", text: req.user },
      ]
    : req.user;

  const body = {
    model,
    max_tokens: req.maxTokens,
    temperature: 0, // extraction, not prose — keep it deterministic
    messages: [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      { role: "user", content },
    ],
    // vLLM constrains decoding to this grammar, so the output is always schema-valid.
    // `strict` is intentionally omitted: OpenAI's strict subset forbids optional
    // properties, which SCAN_RESULT_SCHEMA relies on.
    ...(req.jsonSchema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema },
          },
        }
      : {}),
  };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.LLM_API_KEY ?? "sk-no-key"}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs()),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`llm ${res.status} ${res.statusText}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as OpenAICompletion;
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
    model: json.model ?? model,
    raw: json,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Anthropic (hosted Claude)
// ─────────────────────────────────────────────────────────────────────────

async function callAnthropic(req: ChatRequest): Promise<ChatResponse> {
  const model = modelFor("anthropic", Boolean(req.fast));

  const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
  if (req.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: req.image.mediaType as "image/jpeg",
        data: req.image.base64,
      },
    });
  }
  content.push({ type: "text", text: req.user });

  const res = await anthropic.messages.create({
    model,
    max_tokens: req.maxTokens,
    ...(req.system ? { system: req.system } : {}),
    ...(req.jsonSchema
      ? {
          tools: [
            {
              name: req.jsonSchema.name,
              description: "Return the extracted result.",
              input_schema: req.jsonSchema.schema as Anthropic.Tool["input_schema"],
            },
          ],
          tool_choice: { type: "tool" as const, name: req.jsonSchema.name },
        }
      : {}),
    messages: [{ role: "user", content }],
  });

  // With a forced tool the answer arrives as tool input, not text. Re-serialise it
  // so both providers hand callers the same thing: a JSON string.
  let text: string;
  if (req.jsonSchema) {
    const block = res.content.find(
      (b): b is Extract<typeof b, { type: "tool_use" }> =>
        b.type === "tool_use" && b.name === req.jsonSchema!.name,
    );
    if (!block) throw new Error(`chatJson: model did not call ${req.jsonSchema.name}`);
    text = JSON.stringify(block.input);
  } else {
    text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }

  return {
    text,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    model: res.model,
    raw: res,
  };
}
