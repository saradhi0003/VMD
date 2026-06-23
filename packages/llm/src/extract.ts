import { anthropic, MODEL_FAST } from "./index.js";

/** Structured fields pulled from a milk slip photo or a spoken entry. */
export interface MilkExtraction {
  litres: number | null;
  fatPct: number | null;
  animalTag: string | null;
  animalName: string | null;
  shift: "morning" | "evening" | null;
  rawText: string;
  confidence: number; // 0..1
}

const EMPTY: MilkExtraction = {
  litres: null,
  fatPct: null,
  animalTag: null,
  animalName: null,
  shift: null,
  rawText: "",
  confidence: 0,
};

const INSTRUCTION =
  "You read dairy milk-collection entries. Extract the milk session fields. " +
  "Respond with ONLY a JSON object, no prose, matching: " +
  '{"litres": number|null, "fatPct": number|null, "animalTag": string|null, ' +
  '"animalName": string|null, "shift": "morning"|"evening"|null, "confidence": number}. ' +
  "litres is the quantity in litres. fatPct is the fat percentage (0-15). " +
  "animalTag is a tag/ID like 'VD-C01' if present. confidence is 0..1 for how sure you are.";

function parseJson(text: string, rawText: string): MilkExtraction {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(match ? match[0] : text) as Partial<MilkExtraction>;
    return {
      litres: typeof obj.litres === "number" ? obj.litres : null,
      fatPct: typeof obj.fatPct === "number" ? obj.fatPct : null,
      animalTag: obj.animalTag ?? null,
      animalName: obj.animalName ?? null,
      shift: obj.shift === "morning" || obj.shift === "evening" ? obj.shift : null,
      rawText,
      confidence: typeof obj.confidence === "number" ? obj.confidence : 0.5,
    };
  } catch {
    return { ...EMPTY, rawText };
  }
}

function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Offline fallback parser (no API key): pulls litres / fat% / shift from plain text. */
function regexParse(text: string): MilkExtraction {
  const litM = text.match(/(\d+(?:\.\d+)?)\s*(?:l\b|lit|litre|liter)/i) ?? text.match(/(\d+(?:\.\d+)?)/);
  const fatM = text.match(/fat\s*[:=]?\s*(\d+(?:\.\d+)?)/i) ?? text.match(/(\d+(?:\.\d+)?)\s*%/);
  const shift = /\b(morning|subah)\b/i.test(text) ? "morning" : /\b(evening|shaam)\b/i.test(text) ? "evening" : null;
  return {
    litres: litM ? parseFloat(litM[1]!) : null,
    fatPct: fatM ? parseFloat(fatM[1]!) : null,
    animalTag: null,
    animalName: null,
    shift,
    rawText: text,
    confidence: litM ? 0.6 : 0.2,
  };
}

/** OCR + parse a milk-slip photo. Returns empty extraction if the LLM is unset. */
export async function extractMilkFromImage(base64: string, mediaType: string): Promise<MilkExtraction> {
  if (!isConfigured()) return { ...EMPTY };
  const res = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: base64 },
          },
          { type: "text", text: INSTRUCTION },
        ],
      },
    ],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseJson(text, text);
}

/** Parse a spoken/typed milk entry transcript. Falls back to a regex parser without the LLM. */
export async function extractMilkFromText(transcript: string): Promise<MilkExtraction> {
  if (!isConfigured()) return regexParse(transcript);
  const res = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 512,
    messages: [{ role: "user", content: `${INSTRUCTION}\n\nEntry: "${transcript}"` }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseJson(text, transcript);
}
