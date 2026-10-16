import { UserError } from "@/lib/errors";
import type { Adjustment, Reading, ReadingLine, SourceKind } from "@/lib/types";

/** On means visitors' own uploads are read. The reader is the AI model only when DOCKET_READER=model, otherwise the rules reader (no AI, no cost). */
export function liveReadingEnabled() {
  return process.env.DOCKET_LIVE_READING === "on";
}

export function liveModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

const str = { type: "string" } as const;
const nullableStr = { type: ["string", "null"] } as const;
const nullableNum = { type: ["number", "null"] } as const;

/** Structured-output schema. Every field is required; missing values are null or empty strings. */
export const READING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "customer_name", "customer_quote", "delivery_text", "delivery_quote", "po_number",
    "notes", "repeat_previous", "repeat_quote", "lines", "adjustments",
  ],
  properties: {
    customer_name: str,
    customer_quote: str,
    delivery_text: nullableStr,
    delivery_quote: str,
    po_number: nullableStr,
    notes: nullableStr,
    repeat_previous: { type: "boolean" },
    repeat_quote: str,
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw_text", "product_text", "quantity", "unit_text", "quantity_legible", "source_quote"],
        properties: {
          raw_text: str,
          product_text: str,
          quantity: nullableNum,
          unit_text: str,
          quantity_legible: { type: "boolean" },
          source_quote: str,
        },
      },
    },
    adjustments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "product_text", "quantity", "source_quote"],
        properties: {
          op: { type: "string", enum: ["add", "remove", "change"] },
          product_text: str,
          quantity: nullableNum,
          source_quote: str,
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = [
  "You transcribe wholesale orders that cafés send to a bakery. You do not make decisions about them.",
  "Copy every *_quote field exactly as it appears in the document, with the same spelling and punctuation, so it can be found again. Keep each quote to one line.",
  "customer_name is the café's name as written. delivery_text is the delivery day or date as written, or null if none is given.",
  "Add one line per ordered item. raw_text is the whole line as written. product_text is the item name as written. quantity is the number written. unit_text is any unit written, such as doz, tray or each, or an empty string.",
  "Never correct spelling and never guess what an item is. Never guess a quantity: if it can't be read, set quantity to null and quantity_legible to false.",
  "If the order asks to repeat an earlier one (for example 'same as last week'), set repeat_previous to true, quote those words in repeat_quote, and put each requested change in adjustments instead of lines.",
  "Use empty strings for quotes that don't apply and null for missing values.",
].join("\n");

const unusable = () => new UserError("model_bad", "The AI reader returned something Docket couldn't use.");

export async function readWithModel(input: { source: SourceKind; text?: string; imageDataUrl?: string }): Promise<Reading> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new UserError("live_off", "Live reading isn't set up in this demo.");

  const what = input.source === "csv" ? "spreadsheet export" : input.source === "email" ? "email" : "document";
  const content = input.imageDataUrl
    ? [
        { type: "text", text: "Transcribe this photographed order." },
        { type: "image_url", image_url: { url: input.imageDataUrl } },
      ]
    : `Transcribe this ${what}:\n\n${input.text ?? ""}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: liveModel(),
      temperature: 0,
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "order_reading", strict: true, schema: READING_SCHEMA },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);

  if (!res || !res.ok) throw new UserError("model_failed", "The AI reader didn't respond. Try again in a moment.");
  const json = await res.json().catch(() => null);
  const message = json?.choices?.[0]?.message;
  if (message?.refusal) throw new UserError("model_refused", "The AI reader declined to read this file.");

  let raw: unknown;
  try {
    raw = JSON.parse(message?.content ?? "");
  } catch {
    throw unusable();
  }
  return validateReading(raw);
}

const asStr = (v: unknown): string => {
  if (typeof v !== "string") throw unusable();
  return v.slice(0, 500);
};
const asNullableStr = (v: unknown): string | null => (v === null ? null : asStr(v));
const asNullableNum = (v: unknown): number | null => {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100_000) throw unusable();
  return v;
};
const asBool = (v: unknown): boolean => {
  if (typeof v !== "boolean") throw unusable();
  return v;
};

/** Checks a reading's shape field by field. Anything unexpected is rejected rather than guessed at. */
export function validateReading(raw: unknown): Reading {
  if (!raw || typeof raw !== "object") throw unusable();
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.lines) || !Array.isArray(r.adjustments)) throw unusable();
  if (r.lines.length > 60 || r.adjustments.length > 30) throw unusable();

  return {
    customer_name: asStr(r.customer_name),
    customer_quote: asStr(r.customer_quote),
    delivery_text: asNullableStr(r.delivery_text),
    delivery_quote: asStr(r.delivery_quote),
    po_number: asNullableStr(r.po_number),
    notes: asNullableStr(r.notes),
    repeat_previous: asBool(r.repeat_previous),
    repeat_quote: asStr(r.repeat_quote),
    lines: r.lines.map((item): ReadingLine => {
      const x = (item ?? {}) as Record<string, unknown>;
      return {
        raw_text: asStr(x.raw_text),
        product_text: asStr(x.product_text),
        quantity: asNullableNum(x.quantity),
        unit_text: asStr(x.unit_text),
        quantity_legible: asBool(x.quantity_legible),
        source_quote: asStr(x.source_quote),
      };
    }),
    adjustments: r.adjustments.map((item): Adjustment => {
      const x = (item ?? {}) as Record<string, unknown>;
      const op = asStr(x.op);
      if (op !== "add" && op !== "remove" && op !== "change") throw unusable();
      return {
        op,
        product_text: asStr(x.product_text),
        quantity: asNullableNum(x.quantity),
        source_quote: asStr(x.source_quote),
      };
    }),
  };
}

/** Reads with a model running on this computer through Ollama. Used only by `npm run pre-read`. */
export async function readWithOllama(text: string): Promise<Reading> {
  const base = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "deepseek-r1:7b";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: READING_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: `Transcribe this document:\n\n${text}` },
      ],
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new UserError("model_failed", `Ollama answered ${res.status}. Is it running?`);
  const json = await res.json();
  const content = String(json?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
  } catch {
    throw unusable();
  }
  return validateReading(raw);
}

export function localModelName() {
  return process.env.OLLAMA_MODEL || "deepseek-r1:7b";
}
