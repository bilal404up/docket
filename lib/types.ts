export type SourceKind = "pdf" | "photo" | "email" | "csv";

/** One run of text on a page. Positions are 0 to 1 of the page, y measured from the top. */
export type Run = { t: string; x: number; y: number; w: number; h: number; s?: number; b?: boolean };
export type Rule = { x1: number; y1: number; x2: number; y2: number };
export type Page = { width: number; height: number; runs: Run[]; rules?: Rule[] };

export type TextLayer =
  | { kind: "pages"; pages: Page[] }
  | { kind: "text"; text: string }
  | { kind: "none" };

export type BoxRef = { kind: "box"; page: number; x: number; y: number; w: number; h: number; quote: string };
export type SpanRef = { kind: "span"; start: number; end: number; quote: string };
export type QuoteRef = { kind: "quote"; quote: string };
export type SourceRef = BoxRef | SpanRef | QuoteRef | { kind: "none" };

/** What the AI returns. It transcribes only; it never sees the catalog. */
export type ReadingLine = {
  raw_text: string;
  product_text: string;
  quantity: number | null;
  unit_text: string;
  quantity_legible: boolean;
  source_quote: string;
};

export type Adjustment = {
  op: "add" | "remove" | "change";
  product_text: string;
  quantity: number | null;
  source_quote: string;
};

export type Reading = {
  customer_name: string;
  customer_quote: string;
  delivery_text: string | null;
  delivery_quote: string;
  po_number: string | null;
  notes: string | null;
  repeat_previous: boolean;
  repeat_quote: string;
  lines: ReadingLine[];
  adjustments: Adjustment[];
};

export type ReadingMeta = {
  mode: "fixture" | "live";
  kind: "reference" | "model";
  model: string;
  captured: string;
};

export type MatchMethod = "exact" | "alias" | "learned" | "fuzzy" | "manual" | "repeat" | "none";
export type Severity = "blocker" | "check" | "info";
export type FlagCode =
  | "customer_unrecognized"
  | "unknown_product"
  | "qty_unreadable"
  | "fuzzy_match"
  | "ambiguous_unit"
  | "unit_converted"
  | "repeat_resolved"
  | "duplicate"
  | "unusual_qty"
  | "day_not_served"
  | "after_cutoff"
  | "date_defaulted"
  | "date_past";

export type OrderStatus = "draft" | "approved" | "rejected";
export type DocStatus = "reading" | "ready" | "needs_check" | "approved" | "rejected" | "failed";
