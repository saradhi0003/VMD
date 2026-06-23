import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
export const anthropic = new Anthropic({ apiKey });

export const MODEL_AGENT = process.env.ANTHROPIC_MODEL_AGENT ?? "claude-sonnet-4-6";
export const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001";

export * from "./prompts.js";
export * from "./tools.js";
export * from "./daily-agent.js";
export * from "./extract.js";
