import captured from "./captured.json";
import type { FlagCode, Reading, ReadingLine, ReadingMeta, SourceKind, TextLayer } from "@/lib/types";
import { makePage, table, type RuleSpec, type Text } from "./page";

/*
  The ten sample documents. Each one is built to exercise one rule, and lists the
  flags it must produce (checked by tests/samples.test.ts). All cafés, people and
  orders are invented.
*/
export type Sample = {
  key: string;
  source: SourceKind;
  title: string;
  sender: string;
  /** Time it arrived on the story day, bakery clock, "HH:MM" */
  received: string;
  /** What the sample is there to show */
  tests: string;
  /** Already in the inbox when a sandbox opens; otherwise it waits in the sample tray */
  inInbox: boolean;
  mime: string;
  layer: TextLayer;
  body?: string;
  asset?: string;
  /** A reference reading typed by hand. Replaced by a model's reading once `npm run pre-read` has captured one. */
  reading: Reading;
  expected: { code: FlagCode; line: number | null }[];
};

function line(quote: string, product: string, qty: number | null, unit = ""): ReadingLine {
  return {
    raw_text: quote,
    product_text: product,
    quantity: qty,
    unit_text: unit,
    quantity_legible: qty !== null,
    source_quote: quote,
  };
}

function reading(r: Partial<Reading> & Pick<Reading, "customer_name" | "lines">): Reading {
  return {
    customer_quote: r.customer_name,
    delivery_text: null,
    delivery_quote: "",
    po_number: null,
    notes: null,
    repeat_previous: false,
    repeat_quote: "",
    adjustments: [],
    ...r,
  };
}

function pdf(texts: Text[], rules: RuleSpec[] = []): TextLayer {
  return { kind: "pages", pages: [makePage(texts, rules)] };
}

// 1. A clean table PDF ------------------------------------------------------------
const kettleTable = table(196, [56, 380, 450], ["Item", "Qty", "Unit"], [
  ["Sourdough, large", "6", "each"],
  ["Baguettes", "10", "each"],
  ["Croissants", "24", "each"],
  ["Pain au chocolat", "12", "each"],
]);

const KETTLE_PDF: Sample = {
  key: "kettle-pdf",
  source: "pdf",
  title: "Kettle & Crumb purchase order",
  sender: "orders@kettleandcrumb.example",
  received: "16:02",
  tests: "A clean order with nothing to check",
  inInbox: true,
  mime: "application/pdf",
  layer: pdf(
    [
      { x: 56, y: 56, t: "Kettle & Crumb", s: 20, b: true },
      { x: 56, y: 84, t: "12 Mercer Row · Café and bakery counter", s: 9 },
      { x: 400, y: 58, t: "Purchase order", s: 11, b: true },
      { x: 400, y: 76, t: "PO KC-2291", s: 10 },
      { x: 56, y: 132, t: "To: Ashgrove Bakery, wholesale", s: 10 },
      { x: 56, y: 150, t: "Delivery: Thursday, before 6:00 am", s: 10 },
      ...kettleTable.texts,
      { x: 56, y: kettleTable.bottom + 24, t: "Please invoice monthly as usual. Thank you!", s: 9 },
    ],
    [[56, 104, 556, 104], ...kettleTable.rules],
  ),
  reading: reading({
    customer_name: "Kettle & Crumb",
    delivery_text: "Thursday, before 6:00 am",
    delivery_quote: "Delivery: Thursday, before 6:00 am",
    po_number: "KC-2291",
    notes: "Please invoice monthly as usual. Thank you!",
    lines: [
      line("Sourdough, large 6 each", "Sourdough, large", 6, "each"),
      line("Baguettes 10 each", "Baguettes", 10, "each"),
      line("Croissants 24 each", "Croissants", 24, "each"),
      line("Pain au chocolat 12 each", "Pain au chocolat", 12, "each"),
    ],
  }),
  expected: [],
};

// 2. A free-form letter: shorthand, a misspelling, dozens (the landing page hero) --
const HARBOR_LETTER: Sample = {
  key: "harbor-letter",
  source: "pdf",
  title: "Harbor Lane Café letter",
  sender: "priya@harborlane.example",
  received: "17:52",
  tests: "Shorthand, a misspelling and an order in dozens",
  inInbox: true,
  mime: "application/pdf",
  layer: pdf([
    { x: 56, y: 56, t: "Harbor Lane Café", s: 16, b: true },
    { x: 56, y: 78, t: "14 Quay Street", s: 9 },
    { x: 56, y: 122, t: "Hi Ashgrove team,", s: 11 },
    { x: 56, y: 146, t: "Could we get the following for Thursday, please?", s: 11 },
    { x: 72, y: 174, t: "4 sour lg", s: 11 },
    { x: 72, y: 194, t: "2 doz croissants", s: 11 },
    { x: 72, y: 214, t: "12 cinnamon buns", s: 11 },
    { x: 72, y: 234, t: "6 almond crossaints", s: 11 },
    { x: 56, y: 266, t: "Same drop-off as always, back door by the bins.", s: 11 },
    { x: 56, y: 298, t: "Thanks!", s: 11 },
    { x: 56, y: 316, t: "Priya, Harbor Lane", s: 11 },
  ]),
  reading: reading({
    customer_name: "Harbor Lane Café",
    delivery_text: "Thursday",
    delivery_quote: "for Thursday, please",
    notes: "Same drop-off as always, back door by the bins.",
    lines: [
      line("4 sour lg", "sour lg", 4),
      line("2 doz croissants", "croissants", 2, "doz"),
      line("12 cinnamon buns", "cinnamon buns", 12),
      line("6 almond crossaints", "almond crossaints", 6),
    ],
  }),
  expected: [
    { code: "fuzzy_match", line: 1 },
    { code: "unit_converted", line: 2 },
    { code: "fuzzy_match", line: 4 },
  ],
};

// 3. A photo of a handwritten form: no text layer, one unreadable quantity --------
const JUNIPER_PHOTO: Sample = {
  key: "juniper-photo",
  source: "photo",
  title: "Juniper Kitchen handwritten form",
  sender: "Photo from Lou at Juniper Kitchen",
  received: "18:44",
  tests: "Handwriting, with one quantity nobody can read",
  inInbox: true,
  mime: "image/svg+xml",
  asset: "/samples/juniper-kitchen.svg",
  layer: { kind: "none" },
  reading: reading({
    customer_name: "Juniper Kitchen",
    delivery_text: "Thurs",
    delivery_quote: "Thurs",
    lines: [
      line("Rye x 4", "Rye", 4),
      line("Baguette x 8", "Baguette", 8),
      {
        raw_text: "Focaccia tray x ?",
        product_text: "Focaccia tray",
        quantity: null,
        unit_text: "",
        quantity_legible: false,
        source_quote: "Focaccia tray x",
      },
    ],
  }),
  expected: [{ code: "qty_unreadable", line: 3 }],
};

// 4. "Same as last week", with changes (waits in the tray) -----------------------
const LONGTABLE_BODY = `Hi both,

Same as last week for Thursday please, plus 2 baguettes, and no rye this time.

Cheers,
Sam
The Long Table`;

const LONGTABLE_EMAIL: Sample = {
  key: "longtable-email",
  source: "email",
  title: "The Long Table email",
  sender: "sam@thelongtable.example",
  received: "17:40",
  tests: "\u201cSame as last week\u201d, with changes",
  inInbox: false,
  mime: "text/plain",
  body: LONGTABLE_BODY,
  layer: { kind: "text", text: LONGTABLE_BODY },
  reading: reading({
    customer_name: "The Long Table",
    delivery_text: "Thursday",
    delivery_quote: "for Thursday",
    repeat_previous: true,
    repeat_quote: "Same as last week",
    lines: [],
    adjustments: [
      { op: "add", product_text: "baguettes", quantity: 2, source_quote: "plus 2 baguettes" },
      { op: "remove", product_text: "rye", quantity: null, source_quote: "no rye this time" },
    ],
  }),
  expected: [{ code: "repeat_resolved", line: null }],
};

// 5. No delivery date ------------------------------------------------------------------
const pineTable = table(170, [56, 420], ["Product", "Qty"], [
  ["Croissant", "12"],
  ["Pain au choc", "12"],
  ["Banana loaf", "2"],
]);

const PINEPOUR_PDF: Sample = {
  key: "pinepour-pdf",
  source: "pdf",
  title: "Pine & Pour order",
  sender: "jonah@pineandpour.example",
  received: "17:05",
  tests: "No delivery date",
  inInbox: true,
  mime: "application/pdf",
  layer: pdf(
    [
      { x: 56, y: 56, t: "Pine & Pour", s: 18, b: true },
      { x: 56, y: 82, t: "Coffee · Natural wine · 3 Elm Parade", s: 9 },
      { x: 56, y: 128, t: "Order for Ashgrove Bakery", s: 12, b: true },
      ...pineTable.texts,
      { x: 56, y: pineTable.bottom + 24, t: "Order placed by Jonah at 5:04 pm", s: 9 },
    ],
    pineTable.rules,
  ),
  reading: reading({
    customer_name: "Pine & Pour",
    lines: [
      line("Croissant 12", "Croissant", 12),
      line("Pain au choc 12", "Pain au choc", 12),
      line("Banana loaf 2", "Banana loaf", 2),
    ],
  }),
  expected: [{ code: "date_defaulted", line: null }],
};

// 6. An item that isn't in the catalog ------------------------------------------------------
const millTable = table(146, [56, 420], ["Item", "Qty"], [
  ["Baguette", "20"],
  ["Sourdough small", "6"],
  ["Focaccia slab", "2"],
]);

const MILLST_PDF: Sample = {
  key: "millst-pdf",
  source: "pdf",
  title: "Mill Street Deli order",
  sender: "kitchen@millstreetdeli.example",
  received: "18:20",
  tests: "An item that isn't in the catalog",
  inInbox: true,
  mime: "application/pdf",
  layer: pdf(
    [
      { x: 56, y: 56, t: "Mill Street Deli", s: 18, b: true },
      { x: 56, y: 82, t: "Wholesale order", s: 10 },
      { x: 56, y: 100, t: "Deliver: Thursday", s: 10 },
      ...millTable.texts,
      { x: 56, y: millTable.bottom + 24, t: "Slab is the big rectangular one, cut into squares.", s: 9 },
    ],
    millTable.rules,
  ),
  reading: reading({
    customer_name: "Mill Street Deli",
    delivery_text: "Thursday",
    delivery_quote: "Deliver: Thursday",
    notes: "Slab is the big rectangular one, cut into squares.",
    lines: [
      line("Baguette 20", "Baguette", 20),
      line("Sourdough small 6", "Sourdough small", 6),
      line("Focaccia slab 2", "Focaccia slab", 2),
    ],
  }),
  expected: [{ code: "unknown_product", line: 3 }],
};

// 7. The same order sent twice ------------------------------------------------------------------
const KETTLE_RESEND_BODY = `Hi Ashgrove,

Resending in case the PDF didn't come through.

For Thursday:
6 large sourdough
10 baguettes
24 croissants
12 pain au chocolat

Thanks,
Kettle & Crumb`;

const KETTLE_RESEND: Sample = {
  key: "kettle-resend",
  source: "email",
  title: "Kettle & Crumb resend",
  sender: "orders@kettleandcrumb.example",
  received: "19:31",
  tests: "The same order sent twice",
  inInbox: true,
  mime: "text/plain",
  body: KETTLE_RESEND_BODY,
  layer: { kind: "text", text: KETTLE_RESEND_BODY },
  reading: reading({
    customer_name: "Kettle & Crumb",
    delivery_text: "Thursday",
    delivery_quote: "For Thursday",
    lines: [
      line("6 large sourdough", "large sourdough", 6),
      line("10 baguettes", "baguettes", 10),
      line("24 croissants", "croissants", 24),
      line("12 pain au chocolat", "pain au chocolat", 12),
    ],
  }),
  expected: [{ code: "duplicate", line: null }],
};

// 8. A quantity ten times their usual --------------------------------------------------------
const orchardTable = table(146, [56, 420], ["Item", "Qty"], [
  ["Croissant", "60"],
  ["Almond croissant", "6"],
  ["Cinnamon bun", "6"],
]);

const ORCHARD_PDF: Sample = {
  key: "orchard-pdf",
  source: "pdf",
  title: "Orchard Café order sheet",
  sender: "hello@orchardcafe.example",
  received: "19:15",
  tests: "A quantity ten times their usual",
  inInbox: true,
  mime: "application/pdf",
  layer: pdf(
    [
      { x: 56, y: 56, t: "Orchard Café", s: 18, b: true },
      { x: 56, y: 82, t: "Order sheet", s: 10 },
      { x: 56, y: 100, t: "Delivery day: Thursday", s: 10 },
      ...orchardTable.texts,
    ],
    orchardTable.rules,
  ),
  reading: reading({
    customer_name: "Orchard Café",
    delivery_text: "Thursday",
    delivery_quote: "Delivery day: Thursday",
    lines: [
      line("Croissant 60", "Croissant", 60),
      line("Almond croissant 6", "Almond croissant", 6),
      line("Cinnamon bun 6", "Cinnamon bun", 6),
    ],
  }),
  expected: [{ code: "unusual_qty", line: 1 }],
};

// 9. A day the bakery doesn't deliver to them -----------------------------------------------
const SALTBOX_BODY = `Morning!

For Sunday please:
4 small sourdough
1 focaccia tray
2 seeded loaves

Ta,
Saltbox`;

const SALTBOX_EMAIL: Sample = {
  key: "saltbox-email",
  source: "email",
  title: "Saltbox email",
  sender: "hello@saltbox.example",
  received: "15:20",
  tests: "A day the bakery doesn't deliver to them",
  inInbox: true,
  mime: "text/plain",
  body: SALTBOX_BODY,
  layer: { kind: "text", text: SALTBOX_BODY },
  reading: reading({
    customer_name: "Saltbox",
    delivery_text: "Sunday",
    delivery_quote: "For Sunday",
    lines: [
      line("4 small sourdough", "small sourdough", 4),
      line("1 focaccia tray", "focaccia tray", 1),
      line("2 seeded loaves", "seeded loaves", 2),
    ],
  }),
  expected: [{ code: "day_not_served", line: null }],
};

// 10. A POS export that arrived after the cutoff (waits in the tray) --------------------
const HARBOR_CSV_BODY = `order_ref,customer,deliver_on,sku,item,qty
HL-118,Harbor Lane Cafe,Thursday,BAG,Baguette,6
HL-118,Harbor Lane Cafe,Thursday,BRI,Brioche loaf,2`;

const HARBOR_CSV: Sample = {
  key: "harbor-csv",
  source: "csv",
  title: "Harbor Lane Café POS export",
  sender: "pos@harborlane.example",
  received: "20:40",
  tests: "Arrived after the 8 pm cutoff",
  inInbox: false,
  mime: "text/csv",
  body: HARBOR_CSV_BODY,
  layer: { kind: "text", text: HARBOR_CSV_BODY },
  reading: reading({
    customer_name: "Harbor Lane Cafe",
    delivery_text: "Thursday",
    delivery_quote: "Thursday",
    po_number: "HL-118",
    lines: [line("BAG,Baguette,6", "Baguette", 6), line("BRI,Brioche loaf,2", "Brioche loaf", 2)],
  }),
  expected: [{ code: "after_cutoff", line: null }],
};

export const SAMPLES: Sample[] = [
  KETTLE_PDF,
  HARBOR_LETTER,
  JUNIPER_PHOTO,
  LONGTABLE_EMAIL,
  PINEPOUR_PDF,
  MILLST_PDF,
  KETTLE_RESEND,
  ORCHARD_PDF,
  SALTBOX_EMAIL,
  HARBOR_CSV,
];

export function sampleByKey(key: string): Sample | null {
  return SAMPLES.find((s) => s.key === key) ?? null;
}

type Captured = { model: string; captured: string; reading: Reading };
const CAPTURED = captured as Record<string, Captured | undefined>;

/** The saved reading for a sample: a model's, if `npm run pre-read` captured one, otherwise the reference. */
export function readingFor(sample: Sample): { reading: Reading; meta: ReadingMeta } {
  const c = CAPTURED[sample.key];
  if (c) return { reading: c.reading, meta: { mode: "fixture", kind: "model", model: c.model, captured: c.captured } };
  return { reading: sample.reading, meta: { mode: "fixture", kind: "reference", model: "reference", captured: "by hand" } };
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Recognizes pasted or uploaded text that is one of the email or CSV samples. */
export function matchSampleText(text: string): Sample | null {
  const t = squash(text);
  return SAMPLES.find((s) => s.body && squash(s.body) === t) ?? null;
}
