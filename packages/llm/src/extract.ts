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

// ─────────────────────────────────────────────────────────────────────────
// Multi-document Smart Scan: classify a photographed sheet/receipt and extract.
// ─────────────────────────────────────────────────────────────────────────

export interface ScanMilkRow {
  animal: string | null; // name or tag as written
  litres: number | null;
  fatPct: number | null;
  shift: "morning" | "evening" | null;
}
export interface ScanFeedRow {
  feedType: string | null;
  quantity: string | null;
  animal: string | null;
}
export type ScanResult =
  | { type: "milk_sheet"; confidence: number; rawText: string; rows: ScanMilkRow[] }
  | { type: "feed_sheet"; confidence: number; rawText: string; rows: ScanFeedRow[] }
  | { type: "expense"; confidence: number; rawText: string; category: string | null; payee: string | null; amount: number | null; date: string | null; description: string | null }
  | { type: "other"; confidence: number; rawText: string; title: string | null };

const SCAN_INSTRUCTION =
  "You read photos of dairy-farm paperwork. First CLASSIFY the document as one of: " +
  "milk_sheet (a daily milk log with rows of animals + litres), feed_sheet (a feed/fodder log), " +
  "expense (a bill/receipt/invoice), or other. Then EXTRACT and respond with ONLY a JSON object, no prose:\n" +
  '- milk_sheet: {"type":"milk_sheet","confidence":0..1,"rows":[{"animal":string|null,"litres":number|null,"fatPct":number|null,"shift":"morning"|"evening"|null}]}\n' +
  '- feed_sheet: {"type":"feed_sheet","confidence":0..1,"rows":[{"feedType":string|null,"quantity":string|null,"animal":string|null}]}\n' +
  '- expense: {"type":"expense","confidence":0..1,"category":"feed"|"salaries"|"medication"|"misc"|null,"payee":string|null,"amount":number|null,"date":"YYYY-MM-DD"|null,"description":string|null}\n' +
  '- other: {"type":"other","confidence":0..1,"title":string|null}\n' +
  "Include every readable row. amount is the total in rupees. Use null for anything illegible.";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseScan(text: string): ScanResult {
  let obj: Record<string, unknown> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    obj = JSON.parse(m ? m[0] : text) as Record<string, unknown>;
  } catch {
    return { type: "other", confidence: 0, rawText: text, title: null };
  }
  const confidence = num(obj.confidence) ?? 0.5;
  const t = obj.type;
  if (t === "milk_sheet") {
    const rows: ScanMilkRow[] = (Array.isArray(obj.rows) ? obj.rows : []).map((r: Record<string, unknown>) => ({
      animal: str(r.animal),
      litres: num(r.litres),
      fatPct: num(r.fatPct),
      shift: r.shift === "morning" ? "morning" : r.shift === "evening" ? "evening" : null,
    }));
    return { type: "milk_sheet", confidence, rawText: text, rows };
  }
  if (t === "feed_sheet") {
    const rows = (Array.isArray(obj.rows) ? obj.rows : []).map((r: Record<string, unknown>) => ({
      feedType: str(r.feedType),
      quantity: str(r.quantity),
      animal: str(r.animal),
    }));
    return { type: "feed_sheet", confidence, rawText: text, rows };
  }
  if (t === "expense") {
    return {
      type: "expense",
      confidence,
      rawText: text,
      category: str(obj.category),
      payee: str(obj.payee),
      amount: num(obj.amount),
      date: str(obj.date),
      description: str(obj.description),
    };
  }
  return { type: "other", confidence, rawText: text, title: str(obj.title) };
}

/** Classify + extract a photographed sheet/receipt. Returns `other` (no rows) when the LLM is unset. */
export async function scanDocument(base64: string, mediaType: string): Promise<ScanResult> {
  if (!isConfigured()) return { type: "other", confidence: 0, rawText: "", title: null };
  const res = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: base64 } },
          { type: "text", text: SCAN_INSTRUCTION },
        ],
      },
    ],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseScan(text);
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
