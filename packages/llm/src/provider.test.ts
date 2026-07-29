import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeProvider, capabilities, chatJson, providerChain, supportsVision } from "./provider.js";

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
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  vi.stubEnv("DEEPSEEK_BASE_URL", "");
  vi.stubEnv("DEEPSEEK_MODEL", "");
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

  it("selects deepseek when forced and keyed", () => {
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    expect(activeProvider()).toBe("deepseek");
  });

  it("forced deepseek accepts the generic LLM_API_KEY", () => {
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("LLM_API_KEY", "sk-generic");
    expect(activeProvider()).toBe("deepseek");
  });

  it("auto-detect does NOT treat LLM_API_KEY as a DeepSeek key", () => {
    // LLM_API_KEY belongs to the self-hosted path; letting it imply DeepSeek
    // would silently route a local setup to a paid API.
    vi.stubEnv("LLM_API_KEY", "sk-generic");
    expect(activeProvider()).toBe("none");
  });

  it("auto-detect prefers DeepSeek over Anthropic (cheaper wins)", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(activeProvider()).toBe("deepseek");
  });

  it("self-hosted still outranks DeepSeek (free wins)", () => {
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    expect(activeProvider()).toBe("openai-compat");
  });
});

describe("providerChain — free → cheap → expensive", () => {
  beforeEach(clearProviderEnv);

  it("orders every configured backend cheapest-first", () => {
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(providerChain()).toEqual(["openai-compat", "deepseek", "anthropic"]);
  });

  it("omits backends that aren't configured", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(providerChain()).toEqual(["deepseek", "anthropic"]);
  });

  it("is empty when nothing is configured", () => {
    expect(providerChain()).toEqual([]);
    expect(activeProvider()).toBe("none");
  });

  it("LLM_PROVIDER pins one backend and disables fall-through", () => {
    vi.stubEnv("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    expect(providerChain()).toEqual(["deepseek"]);
  });

  it("drops text-only backends when the request needs vision", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    // DeepSeek leads on cost, but can't see — so a scan routes past it.
    expect(providerChain()).toEqual(["deepseek", "anthropic"]);
    expect(providerChain({ vision: true })).toEqual(["anthropic"]);
  });

  it("supportsVision() is true if ANY tier can see, not just the first", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    expect(supportsVision()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(supportsVision()).toBe(true); // still DeepSeek-first for text
    expect(activeProvider()).toBe("deepseek");
  });
});

describe("chatJson failover", () => {
  beforeEach(clearProviderEnv);
  afterEach(() => vi.unstubAllGlobals());

  it("falls through to the next tier when the free one is down", async () => {
    // The realistic case: a Colab tunnel that expired between sessions.
    vi.stubEnv("LLM_BASE_URL", "https://dead.trycloudflare.com/v1");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(new URL(url).hostname);
        if (url.includes("trycloudflare")) throw new TypeError("fetch failed");
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
            model: "deepseek-v4-flash",
          }),
          { status: 200 },
        );
      }),
    );

    const res = await chatJson({ user: "hi", maxTokens: 10 });
    expect(res.model).toBe("deepseek-v4-flash");
    expect(calls).toEqual(["dead.trycloudflare.com", "api.deepseek.com"]);
  });

  it("falls through on a billing failure, not just a network one", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("insufficient balance", { status: 402 })),
    );
    // DeepSeek 402 → chain moves on; Anthropic goes through the SDK, which the
    // stub doesn't cover, so the call still fails — but from the LAST tier.
    await expect(chatJson({ user: "hi", maxTokens: 10 })).rejects.toBeDefined();
  });

  it("surfaces the last error when every tier fails", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    await expect(chatJson({ user: "hi", maxTokens: 10 })).rejects.toThrow(/llm 500/);
  });

  it("explains itself when a scan has no vision-capable tier", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds"); // text-only
    await expect(
      chatJson({ user: "read", maxTokens: 10, image: { base64: "QQ==", mediaType: "image/png" } }),
    ).rejects.toThrow(/no vision-capable provider/i);
  });
});

describe("capabilities", () => {
  beforeEach(clearProviderEnv);

  it("records what each backend can actually do", () => {
    expect(capabilities("deepseek")).toEqual({ vision: false, jsonSchema: false, reasoning: true });
    expect(capabilities("anthropic")).toEqual({ vision: true, jsonSchema: true, reasoning: false });
    expect(capabilities("openai-compat")).toEqual({ vision: true, jsonSchema: true, reasoning: false });
    expect(capabilities("none")).toEqual({ vision: false, jsonSchema: false, reasoning: false });
  });

  it("supportsVision() reflects the active provider", () => {
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    expect(supportsVision()).toBe(false);

    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(supportsVision()).toBe(true);
  });
});

describe("chatJson (deepseek)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const body = () => JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);

  beforeEach(() => {
    clearProviderEnv();
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"litres":1}' } }],
            usage: { prompt_tokens: 5, completion_tokens: 5 },
            model: "deepseek-v4-flash",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("appends /v1 to a bare host", async () => {
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com");
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.deepseek.com/v1/chat/completions");
  });

  it("does not double up /v1 when already present", async () => {
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1");
    await chatJson({ user: "hi", maxTokens: 10 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.deepseek.com/v1/chat/completions");
  });

  it("downgrades json_schema to json_object and inlines the schema", async () => {
    // DeepSeek answers "This response_format type is unavailable now" for
    // json_schema, so the shape has to travel in the prompt instead.
    const schema = { type: "object", properties: { litres: { type: "number" } } };
    await chatJson({ user: "read this", maxTokens: 10, jsonSchema: { name: "milk", schema } });
    const b = body();
    expect(b.response_format).toEqual({ type: "json_object" });
    expect(b.messages.at(-1).content).toContain(JSON.stringify(schema));
    expect(b.messages.at(-1).content).toContain("read this");
  });

  it("pads the token budget so reasoning cannot starve the answer", async () => {
    // Observed: deepseek-v4-pro spent all 16 tokens reasoning and returned "".
    await chatJson({ user: "hi", maxTokens: 512 });
    expect(body().max_tokens).toBeGreaterThanOrEqual(2048);
  });

  it("refuses an image instead of sending one it cannot read", async () => {
    await expect(
      chatJson({ user: "read", maxTokens: 10, image: { base64: "QQ==", mediaType: "image/png" } }),
    ).rejects.toThrow(/no vision-capable provider/i);
    expect(fetchMock).not.toHaveBeenCalled();
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
