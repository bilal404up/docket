import { describe, expect, it } from "vitest";
import { normProduct } from "@/lib/pipeline/normalize";
import { matchProduct, type CatalogProduct } from "@/lib/pipeline/match";
import { convert } from "@/lib/pipeline/units";
import { parseDelivery } from "@/lib/pipeline/dates";

const catalog: CatalogProduct[] = [
  { id: "SD-L", sku: "SD-L", name: "Sourdough, large", pack: 1, dough: "Sourdough", aliases: [] },
  { id: "CRO", sku: "CRO", name: "Croissant", pack: 1, dough: "Laminated", aliases: [] },
];

describe("normalization and matching", () => {
  it("reads abbreviations and plurals the same way", () => {
    expect(normProduct("Sour Lg.")).toBe(normProduct("sour large"));
  });

  it("matches an exact name and a fuzzy misspelling", () => {
    expect(matchProduct("Croissant", null, catalog).method).toBe("exact");
    expect(matchProduct("croissants", null, catalog).productId).toBe("CRO");
  });

  it("leaves unknown items unmatched", () => {
    expect(matchProduct("Focaccia slab", null, catalog).productId).toBeNull();
  });
});

describe("units", () => {
  it("turns a dozen into twelve", () => {
    expect(convert("doz", 1).factor).toBe(12);
  });
  it("keeps an unknown unit and says so", () => {
    expect(convert("bundle", 1).kind).toBe("unknown");
  });
});

describe("delivery phrases", () => {
  it("reads a weekday as the next one after the order arrived", () => {
    const received = new Date("2026-10-14T16:00:00Z");
    expect(parseDelivery("Thursday", received).date).toBe("2026-10-15");
  });
});
