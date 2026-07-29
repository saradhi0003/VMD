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

export type Provider = "openai-compat" | "anthropic" | "deepseek" | "none";

/** Default model for the Colab server — one 7B VLM covers both vision and text roles. */
const DEFAULT_OSS_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct-AWQ";

const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";

/** A free T4 takes 30-90s on a full-page scan, so the ceiling is generous. */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * What each backend can actually do. Verified against the live APIs — these are
 * not guesses, and getting them wrong fails at runtime rather than at compile time.
 *
 *  • `vision`     — accepts an `image_url` content block. DeepSeek rejects the
 *                   block outright ("unknown variant `image_url`"), so Smart Scan
 *                   is impossible on it and must degrade rather than throw.
 *  • `jsonSchema` — supports `response_format: {type:"json_schema"}` and so can be
 *                   grammar-constrained. DeepSeek answers "This response_format
 *                   type is unavailable now"; it only offers `json_object`, which
 *                   guarantees *valid JSON* but not *our shape* — so the schema
 *                   has to go into the prompt and `parseJson`/`parseScan` become
 *                   load-bearing again.
 *  • `reasoning`  — burns completion tokens on hidden reasoning before emitting
 *                   any content. Budgets must be padded or `content` comes back
 *                   EMPTY with finish_reason "length" (observed on deepseek-v4-pro
 *                   at max_tokens 16).
 */
interface Capabilities {
  vision: boolean;
  jsonSchema: boolean;
  reasoning: boolean;
}

const CAPABILITIES: Record<Exclude<Provider, "none">, Capabilities> = {
  "openai-compat": { vision: true, jsonSchema: true, reasoning: false },
  anthropic: { vision: true, jsonSchema: true, reasoning: false },
  deepseek: { vision: false, jsonSchema: false, reasoning: true },
};

export function capabilities(p: Provider = activeProvider()): Capabilities {
  return p === "none"
    ? { vision: false, jsonSchema: false, reasoning: false }
    : CAPABILITIES[p];
}

/**
 * Is ANY configured backend able to read a photo? Smart Scan checks this before
 * calling. Deliberately not "can the *first* one" — if DeepSeek leads but
 * Anthropic is also configured, scanning still works via fall-through.
 */
export function supportsVision(): boolean {
  return providerChain({ vision: true }).length > 0;
}

/**
 * DeepSeek's bearer token.
 *
 * When the provider is chosen *explicitly* the generic `LLM_API_KEY` is accepted
 * as a convenience. Auto-detection deliberately requires `DEEPSEEK_API_KEY`:
 * `LLM_API_KEY` belongs to the openai-compat path, and letting it imply DeepSeek
 * would silently route a self-hosted setup to a paid API.
 */
function deepseekKey(explicit = false): string | undefined {
  return explicit
    ? process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY
    : process.env.DEEPSEEK_API_KEY;
}

/** Preference order: **free → cheap → expensive**. */
const PREFERENCE = ["openai-compat", "deepseek", "anthropic"] as const;

function isConfigured(p: Exclude<Provider, "none">, explicit = false): boolean {
  switch (p) {
    case "openai-compat":
      return Boolean(process.env.LLM_BASE_URL);
    case "deepseek":
      return Boolean(deepseekKey(explicit));
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
  }
}

/**
 * Every usable backend, best-first.
 *
 * Returning a *chain* rather than a single winner is what makes the ordering
 * meaningful. The free tier is also the least reliable — a Colab tunnel dies on
 * idle and its URL rotates every session — so without fall-through, "prefer
 * free" would mean "break whenever Colab naps".
 *
 * `LLM_PROVIDER` pins one backend and disables fall-through, which is what you
 * want when reproducing a bug against a specific model.
 *
 * @param need Filter to backends that can do the job — an image request skips
 *             text-only providers entirely, so Smart Scan quietly uses whatever
 *             vision-capable tier exists even when DeepSeek leads the chain.
 */
export function providerChain(need?: { vision?: boolean }): Exclude<Provider, "none">[] {
  const pinned = PREFERENCE.find((p) => p === process.env.LLM_PROVIDER);
  let chain = pinned
    ? isConfigured(pinned, true)
      ? [pinned]
      : []
    : PREFERENCE.filter((p) => isConfigured(p));
  if (need?.vision) chain = chain.filter((p) => CAPABILITIES[p].vision);
  return [...chain];
}

/**
 * The backend that will be tried first. `"none"` means callers fall back to
 * their offline behaviour — never an error.
 */
export function activeProvider(): Provider {
  return providerChain()[0] ?? "none";
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
  if (provider === "deepseek") {
    const configured =
      (fast ? process.env.LLM_MODEL_FAST : process.env.LLM_MODEL_AGENT) ||
      process.env.DEEPSEEK_MODEL;
    return configured || DEEPSEEK_DEFAULT_MODEL;
  }
  return fast ? MODEL_FAST : MODEL_AGENT;
}

/** Base URL + bearer token for an OpenAI-shaped backend. */
function endpointFor(provider: Provider): { base: string; key: string } {
  if (provider === "deepseek") {
    // Deliberately NOT LLM_BASE_URL — that belongs to the self-hosted tier. Both
    // can be configured at once now that the chain falls through, and sharing
    // the variable would point DeepSeek at the Colab tunnel.
    let base = process.env.DEEPSEEK_BASE_URL || DEEPSEEK_DEFAULT_BASE;
    base = base.replace(/\/+$/, "");
    // DEEPSEEK_BASE_URL is commonly set to the bare host; the REST path is /v1.
    if (!/\/v\d+$/.test(base)) base += "/v1";
    return { base, key: deepseekKey(true) ?? "" };
  }
  return {
    base: (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, ""),
    key: process.env.LLM_API_KEY ?? "sk-no-key",
  };
}

/**
 * Reasoning models spend completion tokens thinking before they emit anything,
 * and that spend counts against `max_tokens`. Without headroom the answer is
 * truncated to "" and every caller silently sees an empty extraction.
 */
function budget(provider: Provider, maxTokens: number): number {
  return capabilities(provider).reasoning ? Math.max(maxTokens * 4, 2048) : maxTokens;
}

/**
 * When a backend can't be grammar-constrained, the schema has to travel in the
 * prompt instead. `json_object` still guarantees syntactically valid JSON, so
 * only the *shape* is on trust — which is exactly what parseJson/parseScan
 * already defend against.
 */
function inlineSchema(user: string, schema: Record<string, unknown>): string {
  return `${user}\n\nRespond with ONLY a JSON object conforming to this JSON Schema. No prose, no markdown fences.\n${JSON.stringify(schema)}`;
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
  const chain = providerChain(req.image ? { vision: true } : undefined);

  if (chain.length === 0) {
    throw new Error(
      req.image
        ? "chatJson: no vision-capable provider configured (DeepSeek is text-only)"
        : "chatJson: no LLM provider configured",
    );
  }

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]!;
    try {
      return p === "anthropic" ? await callAnthropic(req) : await callOpenAICompat(req, p);
    } catch (err) {
      lastError = err;
      const next = chain[i + 1];
      const why = err instanceof Error ? err.message : String(err);
      // Any failure moves down the chain: a dead tunnel, an expired key and an
      // empty credit balance are indistinguishable from here, and all mean the
      // same thing — this tier can't serve the request right now.
      console.warn(
        `[llm] ${p} failed${next ? `, falling back to ${next}` : " (last in chain)"}: ${why.slice(0, 160)}`,
      );
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI-compatible (vLLM on Colab, or any /v1 server)
// ─────────────────────────────────────────────────────────────────────────

interface OpenAICompletion {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

async function callOpenAICompat(req: ChatRequest, provider: Provider): Promise<ChatResponse> {
  const { base, key } = endpointFor(provider);
  const model = modelFor(provider, Boolean(req.fast));
  const caps = capabilities(provider);

  const userText =
    req.jsonSchema && !caps.jsonSchema ? inlineSchema(req.user, req.jsonSchema.schema) : req.user;

  // Image first, text second — same block order the Anthropic calls used.
  const content = req.image
    ? [
        {
          type: "image_url",
          image_url: { url: `data:${req.image.mediaType};base64,${req.image.base64}` },
        },
        { type: "text", text: userText },
      ]
    : userText;

  const body = {
    model,
    max_tokens: budget(provider, req.maxTokens),
    temperature: 0, // extraction, not prose — keep it deterministic
    messages: [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      { role: "user", content },
    ],
    // With json_schema the backend grammar-constrains decoding, so output is
    // always schema-valid. Backends that lack it (DeepSeek) get json_object —
    // valid JSON, unenforced shape — with the schema inlined above.
    // `strict` is intentionally omitted: OpenAI's strict subset forbids optional
    // properties, which SCAN_RESULT_SCHEMA relies on.
    ...(req.jsonSchema
      ? caps.jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema },
            },
          }
        : { response_format: { type: "json_object" } }
      : {}),
  };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
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
