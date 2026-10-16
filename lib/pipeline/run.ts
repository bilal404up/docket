import type { SupabaseClient } from "@supabase/supabase-js";
import { liveModel, liveReadingEnabled, readWithModel } from "@/lib/ai/read";
import { readWithRules } from "@/lib/ai/rules";
import { storyAt, storyNow } from "@/lib/clock";
import { UserError, must } from "@/lib/errors";
import { logEvent } from "@/lib/events";
import { countsLabel } from "@/lib/flags";
import { LIMITS } from "@/lib/limits";
import { extractLayer, inspectPdf } from "@/lib/pdf";
import { matchSampleText, readingFor, sampleByKey, type Sample } from "@/lib/samples";
import type { DocStatus, Reading, ReadingMeta, SourceKind, TextLayer } from "@/lib/types";
import type { Workspace } from "@/lib/workspace";
import { buildCtx } from "./context";
import { layerToText } from "./locate";
import { processReading } from "./process";
import { draftToRows } from "./rows";

export type Step = { label: string; ms: number; note?: string };
export type IngestInput =
  | { kind: "sample"; sampleKey: string }
  | { kind: "text"; text: string }
  | { kind: "file"; name: string; mime: string; bytes: Uint8Array };
export type IngestResult = {
  documentId: string;
  orderId: string | null;
  status: DocStatus;
  steps: Step[];
  meta: ReadingMeta | null;
  error: string | null;
};

type Fixture = { reading: Reading; meta: ReadingMeta };
type Prepared = {
  sample: Sample | null;
  source: SourceKind;
  title: string;
  sender: string | null;
  mime: string;
  layer: TextLayer;
  body: string | null;
  file: { name: string; bytes: Uint8Array; mime: string } | null;
  receivedAt: Date;
  textMs: number;
  textNote: string;
};

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TEXT_MIMES = new Set(["text/plain", "text/csv"]);

function timer() {
  const t0 = performance.now();
  return () => Math.max(1, Math.round(performance.now() - t0));
}

function looksLikeCsv(text: string) {
  const lines = text.trim().split("\n").filter(Boolean);
  return lines.length >= 2 && lines.every((l) => (l.match(/,/g) ?? []).length >= 2);
}

/* A sample keeps its own arrival time wherever it comes from (inbox, tray, or uploaded
   back), so it always produces the same flags. */
function fromSample(sample: Sample, ws: Workspace): Prepared {
  return {
    sample,
    source: sample.source,
    title: sample.title,
    sender: sample.sender,
    mime: sample.mime,
    layer: sample.layer,
    body: sample.body ?? null,
    file: null,
    receivedAt: storyAt(ws.story_date, sample.received),
    textMs: 0,
    textNote: sample.layer.kind === "none" ? "A photo has no text layer" : "Saved with the sample",
  };
}

function fromText(text: string, ws: Workspace): Prepared {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) throw new UserError("empty", "There's no text to read.");
  if (clean.length > LIMITS.textChars) {
    throw new UserError("too_long", `That's over ${LIMITS.textChars.toLocaleString("en-US")} characters. Paste just the order.`);
  }
  const sample = matchSampleText(clean);
  if (sample) return fromSample(sample, ws);
  const csv = looksLikeCsv(clean);
  return {
    sample: null,
    source: csv ? "csv" : "email",
    title: csv ? "Pasted CSV" : "Pasted email",
    sender: null,
    mime: csv ? "text/csv" : "text/plain",
    layer: { kind: "text", text: clean },
    body: clean,
    file: null,
    receivedAt: storyNow(ws),
    textMs: 0,
    textNote: "Pasted as text",
  };
}

async function fromFile(name: string, mime: string, bytes: Uint8Array, ws: Workspace): Promise<Prepared> {
  if (bytes.byteLength > LIMITS.fileBytes) throw new UserError("too_big", "That file is over 4 MB. Try a smaller one.");
  const safeName = name.replace(/[^\w.\-]+/g, "_").slice(-80) || "upload";

  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    const info = await inspectPdf(bytes);
    if (info.pages > LIMITS.pages) {
      throw new UserError("too_many_pages", `That PDF has ${info.pages} pages. The limit is ${LIMITS.pages}.`);
    }
    const sample = info.sampleKey ? sampleByKey(info.sampleKey) : null;
    if (sample) return { ...fromSample(sample, ws), title: `${sample.title} (uploaded)` };
    const t = timer();
    const layer = await extractLayer(bytes);
    const ms = t();
    const runs = layer.kind === "pages" ? layer.pages.reduce((n, p) => n + p.runs.length, 0) : 0;
    if (!runs) {
      throw new UserError("no_text", "This PDF has no text in it, so it's probably a scan. Take a photo of the page instead.");
    }
    const pages = layer.kind === "pages" ? layer.pages.length : 0;
    return {
      sample: null,
      source: "pdf",
      title: name.replace(/\.pdf$/i, "") || "Uploaded PDF",
      sender: null,
      mime: "application/pdf",
      layer,
      body: null,
      file: { name: safeName, bytes, mime: "application/pdf" },
      receivedAt: storyNow(ws),
      textMs: ms,
      textNote: `${runs} runs of text on ${pages} page${pages === 1 ? "" : "s"}`,
    };
  }

  if (IMAGE_MIMES.has(mime)) {
    return {
      sample: null,
      source: "photo",
      title: "Uploaded photo",
      sender: null,
      mime,
      layer: { kind: "none" },
      body: null,
      file: { name: safeName, bytes, mime },
      receivedAt: storyNow(ws),
      textMs: 0,
      textNote: "A photo has no text layer",
    };
  }

  if (TEXT_MIMES.has(mime) || /\.(txt|csv|eml)$/i.test(name)) {
    return fromText(new TextDecoder().decode(bytes), ws);
  }

  throw new UserError("bad_type", "Docket reads PDF, JPG, PNG, WebP and plain text. iPhone HEIC photos need to be saved as JPG first.");
}

async function consumeLive(sb: SupabaseClient, ws: Workspace) {
  if (!liveReadingEnabled()) {
    throw new UserError("live_off", "Live reading is off in this demo, so no paid AI runs. Try a sample, or download one and upload it back.");
  }
  const { data: ok, error } = await sb.rpc("consume_reading_quota", {
    p_ws: ws.id,
    p_ws_limit: LIMITS.livePerSandbox,
    p_global_limit: LIMITS.liveSiteWide,
  });
  if (error) throw new Error(error.message);
  if (!ok) throw new UserError("quota", "Today's live readings are used up. Try a sample instead.");
}

type BuildArgs = {
  documentId: string;
  title: string;
  source: SourceKind;
  layer: TextLayer;
  image: { bytes: Uint8Array; mime: string } | null;
  receivedAt: Date;
  fixture: Fixture | null;
  steps: Step[];
  payload: Record<string, unknown>;
};

/** Reads a stored document, runs the decision engine and saves the draft order. */
async function readAndBuild(sb: SupabaseClient, ws: Workspace, a: BuildArgs): Promise<IngestResult> {
  const steps = a.steps;
  let reading: Reading;
  let meta: ReadingMeta;
  const tRead = timer();
  try {
    if (a.fixture) {
      reading = a.fixture.reading;
      meta = a.fixture.meta;
    } else {
      const today = new Date().toISOString().slice(0, 10);
      if (process.env.DOCKET_READER === "model") {
        const imageDataUrl = a.image ? `data:${a.image.mime};base64,${Buffer.from(a.image.bytes).toString("base64")}` : undefined;
        reading = await readWithModel({ source: a.source, text: imageDataUrl ? undefined : layerToText(a.layer), imageDataUrl });
        meta = { mode: "live", kind: "model", model: liveModel(), captured: today };
      } else {
        if (a.image) throw new UserError("photo_needs_model", "Photos need the AI reader, which is off in this demo. Upload a PDF or a text file instead.");
        reading = readWithRules(layerToText(a.layer));
        meta = { mode: "live", kind: "rules", model: "rules, no AI", captured: today };
      }
    }
  } catch (e) {
    const message = e instanceof UserError ? e.message : "The AI reader failed. Try again.";
    if (!(e instanceof UserError)) console.error(e);
    await sb.from("documents").update({ status: "failed", error: message }).eq("id", a.documentId);
    steps.push({ label: "Reading with AI", ms: tRead(), note: message });
    await logEvent(sb, ws.id, "document.failed", `Couldn't read ${a.title}`, { document_id: a.documentId, ...a.payload });
    return { documentId: a.documentId, orderId: null, status: "failed", steps, meta: null, error: message };
  }
  const readMs = tRead();
  await must(
    sb.from("readings").insert({
      workspace_id: ws.id,
      document_id: a.documentId,
      mode: meta.mode,
      kind: meta.kind,
      model: meta.model,
      captured: meta.captured,
      raw: reading,
      duration_ms: readMs,
    }),
  );
  steps.push({
    label: "Reading with AI",
    ms: readMs,
    note:
      meta.mode === "live"
        ? `Live, ${meta.model}`
        : meta.kind === "model"
          ? `Saved reading by ${meta.model}, ${meta.captured}`
          : "Saved reference reading, typed by hand",
  });

  const tMatch = timer();
  const ctx = await buildCtx(sb, ws.id, a.receivedAt, storyNow(ws));
  const draft = processReading(reading, a.layer, ctx);
  const matched = draft.lines.filter((l) => l.productId).length;
  const open = draft.flags.filter((f) => f.severity !== "info");
  steps.push({
    label: "Matching and checking",
    ms: tMatch(),
    note: `${matched} of ${draft.lines.length} lines matched, ${open.length ? `${open.length} to look at` : "nothing to check"}`,
  });

  const tSave = timer();
  const rows = draftToRows(ws.id, a.documentId, draft);
  await must(sb.from("orders").insert(rows.order));
  if (rows.lines.length) await must(sb.from("order_lines").insert(rows.lines));
  if (rows.flags.length) await must(sb.from("flags").insert(rows.flags));
  await must(sb.from("documents").update({ status: rows.status, error: null }).eq("id", a.documentId));
  steps.push({ label: "Saved as a draft order", ms: tSave() });

  const blockers = open.filter((f) => f.severity === "blocker").length;
  await logEvent(
    sb,
    ws.id,
    "document.read",
    `Read ${a.title}: ${draft.lines.length} lines, ${countsLabel(blockers, open.length - blockers) || "nothing to check"}`,
    { document_id: a.documentId, order_id: rows.orderId, ...a.payload },
  );
  return { documentId: a.documentId, orderId: rows.orderId, status: rows.status as DocStatus, steps, meta, error: null };
}

/** Adds a document to the sandbox: checks it, stores it, reads it and builds a draft order. */
export async function ingest(
  sb: SupabaseClient,
  ws: Workspace,
  input: IngestInput,
  by: "seed" | "visitor" = "visitor",
): Promise<IngestResult> {
  const { count } = await sb.from("documents").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id);
  if ((count ?? 0) >= LIMITS.docsPerSandbox) {
    throw new UserError("full", `This sandbox holds ${LIMITS.docsPerSandbox} documents. Reset the demo to start again.`);
  }

  let prep: Prepared;
  if (input.kind === "sample") {
    const sample = sampleByKey(input.sampleKey);
    if (!sample) throw new UserError("no_sample", "That sample doesn't exist.");
    prep = fromSample(sample, ws);
  } else if (input.kind === "text") {
    prep = fromText(input.text, ws);
  } else {
    prep = await fromFile(input.name, input.mime, input.bytes, ws);
  }

  // Decide how it will be read before anything is stored.
  const fixture = prep.sample ? readingFor(prep.sample) : null;
  if (!fixture) await consumeLive(sb, ws);

  const tStore = timer();
  const documentId = crypto.randomUUID();
  let filePath: string | null = null;
  if (prep.file) {
    filePath = `${ws.id}/${documentId}/${prep.file.name}`;
    const { error } = await sb.storage.from("uploads").upload(filePath, prep.file.bytes, { contentType: prep.file.mime, upsert: false });
    if (error) throw new UserError("store_failed", "The file couldn't be stored. Try again.");
  }
  await must(
    sb.from("documents").insert({
      id: documentId,
      workspace_id: ws.id,
      sample_key: prep.sample?.key ?? null,
      source: prep.source,
      title: prep.title,
      sender: prep.sender,
      file_path: filePath,
      mime: prep.mime,
      text_layer: prep.layer,
      body_text: prep.body,
      status: "reading",
      received_at: prep.receivedAt.toISOString(),
    }),
  );
  const steps: Step[] = [
    { label: "Stored", ms: tStore(), note: prep.file ? "In private storage" : "Sample document" },
    { label: "Reading text", ms: Math.max(prep.textMs, 1), note: prep.textNote },
  ];

  return readAndBuild(sb, ws, {
    documentId,
    title: prep.title,
    source: prep.source,
    layer: prep.layer,
    image: prep.source === "photo" && prep.file ? { bytes: prep.file.bytes, mime: prep.file.mime } : null,
    receivedAt: prep.receivedAt,
    fixture,
    steps,
    payload: { sample_key: prep.sample?.key ?? null, by, via: input.kind },
  });
}

/** Tries a failed document again. */
export async function rereadDocument(sb: SupabaseClient, ws: Workspace, documentId: string): Promise<IngestResult> {
  const { data: doc } = await sb
    .from("documents")
    .select("id,status,source,title,sample_key,text_layer,file_path,mime,received_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) throw new UserError("not_found", "That document isn't in your sandbox.");
  if (doc.status !== "failed") throw new UserError("not_failed", "Only documents that failed to read can be read again.");

  const sample = doc.sample_key ? sampleByKey(doc.sample_key) : null;
  const fixture = sample ? readingFor(sample) : null;
  if (!fixture) await consumeLive(sb, ws);

  let image: { bytes: Uint8Array; mime: string } | null = null;
  if (!fixture && doc.source === "photo" && doc.file_path) {
    const { data, error } = await sb.storage.from("uploads").download(doc.file_path);
    if (error || !data) throw new UserError("missing_file", "The original file is gone. Delete this one and upload it again.");
    image = { bytes: new Uint8Array(await data.arrayBuffer()), mime: doc.mime };
  }
  await sb.from("documents").update({ status: "reading", error: null }).eq("id", doc.id);

  return readAndBuild(sb, ws, {
    documentId: doc.id,
    title: doc.title,
    source: doc.source,
    layer: doc.text_layer as TextLayer,
    image,
    receivedAt: new Date(doc.received_at),
    fixture,
    steps: [],
    payload: { sample_key: doc.sample_key, by: "visitor", via: "retry" },
  });
}
