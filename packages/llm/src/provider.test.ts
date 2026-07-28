import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeProvider, chatJson } from "./provider.js";

/**
 * Provider adapter. All offline — `fetch` is stubbed, so these are free and fast
 * and never touch a real LLM (Colab or Anthropic).
 */

/** Clears every provider-selecting env var so each test starts from a known state. */
function clearProviderEnv() {
  vi.stubEnv("LLM_PROVIDER", "");
  vi.stubEnv("LLM_BASE_URL", "");
  vi.stubEnv("LLM_API_KEY", "");
  vi.stubEnv("LLM_MODEL_FAST", "");
  vi.stubEnv("LLM_MODEL_AGENT", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

describe("activeProvider", () => {
  beforeEach(clearProviderEnv);

  it("returns 'none' when nothing is configured", () => {
    expect(activeProvider()).toBe("none");
  });

  it("prefers the self-hosted server over Anthropic when both are set", () => {
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(activeProvider()).toBe("openai-compat");
  });

  it("falls back to anthropic when only the API key is set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(activeProvider()).toBe("anthropic");
  });

  it("honours an explicit LLM_PROVIDER override", () => {
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    expect(activeProvider()).toBe("anthropic");
  });

  it("returns 'none' when the forced provider is itself unconfigured", () => {
    vi.stubEnv("LLM_PROVIDER", "openai-compat"); // but no LLM_BASE_URL
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(activeProvider()).toBe("none");
  });
});

describe("chatJson (openai-compat)", () => {
  const okBody = {
    choices: [{ message: { content: '{"litres":12.5}' } }],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
    model: "Qwen/Qwen2.5-VL-7B-Instruct-AWQ",
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearProviderEnv();
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    vi.stubEnv("LLM_API_KEY", "secret-token");
    fetchMock = vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Pulls the parsed JSON body off the single recorded fetch call. */
  function sentBody(): Record<string, any> {
    return JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
  }

  it("throws when no provider is configured", async () => {
    vi.stubEnv("LLM_BASE_URL", "");
    await expect(chatJson({ user: "hi", maxTokens: 10 })).rejects.toThrow(/no LLM provider/i);
  });

  it("returns the message content and token usage", async () => {
    const res = await chatJson({ user: "hi", maxTokens: 10 });
    expect(res.text).toBe('{"litres":12.5}');
    expect(res.inputTokens).toBe(100);
    expect(res.outputTokens).toBe(20);
    expect(res.model).toBe("Qwen/Qwen2.5-VL-7B-Instruct-AWQ");
  });

  it("posts to /chat/completions with a Bearer token", async () => {
    await chatJson({ user: "hi", maxTokens: 10 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://x.trycloudflare.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: "Bearer secret-token",
    });
  });

  it("sends an image as a data: URI ordered before the text block", async () => {
    await chatJson({
      user: "read this",
      image: { base64: "QUJD", mediaType: "image/png" },
      maxTokens: 10,
    });
    const content = sentBody().messages.at(-1).content;
    expect(content[0].type).toBe("image_url");
    expect(content[0].image_url.url).toBe("data:image/png;base64,QUJD");
    expect(content[1]).toEqual({ type: "text", text: "read this" });
  });

  it("sends a plain string body when there is no image", async () => {
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(sentBody().messages.at(-1).content).toBe("hi");
  });

  it("passes a json_schema response_format when a schema is supplied", async () => {
    const schema = { type: "object", properties: { litres: { type: "number" } } };
    await chatJson({ user: "hi", maxTokens: 10, jsonSchema: { name: "milk", schema } });
    expect(sentBody().response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "milk", schema },
    });
  });

  it("omits response_format when no schema is supplied", async () => {
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(sentBody().response_format).toBeUndefined();
  });

  it("prepends a system message only when given one", async () => {
    await chatJson({ user: "hi", maxTokens: 10, system: "be terse" });
    expect(sentBody().messages[0]).toEqual({ role: "system", content: "be terse" });

    fetchMock.mockClear();
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(sentBody().messages).toHaveLength(1);
  });

  it("selects the fast vs agent model", async () => {
    vi.stubEnv("LLM_MODEL_FAST", "fast-model");
    vi.stubEnv("LLM_MODEL_AGENT", "agent-model");

    await chatJson({ user: "hi", maxTokens: 10, fast: true });
    expect(sentBody().model).toBe("fast-model");

    fetchMock.mockClear();
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(sentBody().model).toBe("agent-model");
  });

  it("tolerates a base URL with a trailing slash", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1/");
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://x.trycloudflare.com/v1/chat/completions");
  });

  it("throws on a non-2xx response so callers can degrade", async () => {
    fetchMock.mockResolvedValueOnce(new Response("model not found", { status: 500 }));
    await expect(chatJson({ user: "hi", maxTokens: 10 })).rejects.toThrow(/llm 500/);
  });
});
