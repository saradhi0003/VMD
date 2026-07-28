# Free LLM server on Google Colab

Runs **Qwen2.5-VL-7B (AWQ)** on a free Colab T4 behind an OpenAI-compatible API, so Smart Scan,
voice entry, the owner assistant and the daily agent all work at **zero cost** — no Anthropic key.

**→ [`vayumukhi-llm-server.ipynb`](vayumukhi-llm-server.ipynb)** — open it in
[Google Colab](https://colab.research.google.com/), set **Runtime → Change runtime type → T4 GPU**,
and run top to bottom. It prints the exact `.env.local` block to paste.

## Read this before you rely on it

- **This is a dev/evaluation rig, not a production backend.** Google's
  [Colab FAQ](https://research.google.com/colaboratory/faq.html) prohibits "bypassing the notebook UI
  to interact primarily via a web UI," and free runtimes get reclaimed. Don't point a deployed app at it.
- **The tunnel URL changes every session.** Re-run cells 3–6 and re-paste `LLM_BASE_URL` into
  `.env.local` each time, then restart `pnpm dev`.
- **Idle ~90 min, hard cap ~12 h.**
- **It is slow: 30–90 s per full-page scan**, vs ~3 s on hosted Claude. That is the price of $0.

## How the app picks a provider

Resolved in [`packages/llm/src/provider.ts`](../../packages/llm/src/provider.ts) by `activeProvider()`:

| Env state | Provider used |
|---|---|
| `LLM_BASE_URL` set | **`openai-compat`** — the Colab server (wins over Anthropic; it's free) |
| only `ANTHROPIC_API_KEY` set | `anthropic` — hosted Claude, costs money |
| neither | `none` — offline regex fallback; the app still works, scans return `type: "other"` |
| `LLM_PROVIDER` set | forces that backend, or `none` if it isn't configured |

Nothing ever throws at the user: every call site try/catches and degrades (golden rule 5).

## Why this model

The T4 is Turing (SM75), which constrains the field hard:

- **No bf16** → the notebook passes `--dtype half`. Non-negotiable.
- **Qwen3-VL and other newer VLMs have no Turing backend in vLLM**
  ([vllm#29743](https://github.com/vllm-project/vllm/issues/29743)) — they will not start on a T4.
- Qwen2.5-VL-7B is a strong document-OCR model *and* a solid text model, so **one server fills both
  the `FAST` and `AGENT` roles**. AWQ 4-bit weights (~5 GB) leave room for the vision encoder and KV
  cache inside 16 GB.

`allenai/olmOCR-2-7B-1025` scores higher on pure OCR benchmarks and is a drop-in on the same
hardware, but it emits its own document format rather than our `{type, confidence, rows[]}` shape,
so `parseScan` would need an adapter. Worth trying if handwriting accuracy is the blocker.

## Structured output

The server is asked for `response_format: {type: "json_schema", ...}`, which makes vLLM
**constrain decoding to the grammar** — the model cannot emit invalid JSON. Schemas live in
[`packages/llm/src/tools.ts`](../../packages/llm/src/tools.ts) (`MILK_EXTRACTION_SCHEMA`,
`SCAN_RESULT_SCHEMA`). `SCAN_RESULT_SCHEMA` is deliberately one flat object rather than a `oneOf`
union — grammar backends handle discriminated unions poorly, and `parseScan` already reads a flat bag.

## Any other OpenAI-compatible server works

Nothing here is Colab-specific. Point `LLM_BASE_URL` at a local Ollama/vLLM/LM Studio instance, a
rented GPU, or a hosted OpenAI-compatible endpoint and the app behaves identically.
