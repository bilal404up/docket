import { describe, expect, it } from "vitest";
import { readWithRules } from "@/lib/ai/rules";

describe("rules reader (no AI)", () => {
  it("reads a customer, a delivery day, a PO and quantity lines", () => {
    const r = readWithRules(
      ["Customer: Maple Cafe", "PO number: MC-204", "Deliver on Friday", "3 doz croissants", "2 loaves sourdough", "Rye - 4"].join("\n"),
    );
    expect(r.customer_name).toBe("Maple Cafe");
    expect(r.po_number).toBe("MC-204");
    expect(r.delivery_text).toBe("Friday");
    expect(r.lines.map((l) => [l.product_text, l.quantity, l.unit_text])).toEqual([
      ["croissants", 3, "doz"],
      ["sourdough", 2, "loaves"],
      ["Rye", 4, ""],
    ]);
    expect(r.lines.every((l) => l.quantity_legible)).toBe(true);
  });

  it("never guesses a quantity it cannot read", () => {
    const r = readWithRules("Customer: Harbor Cafe\nsome bread please");
    expect(r.lines).toHaveLength(0);
    expect(r.customer_name).toBe("Harbor Cafe");
  });

  it("notices a repeat order and reads the requested changes", () => {
    const r = readWithRules("Hello, same as last week\nadd 2 croissants\nremove rye");
    expect(r.repeat_previous).toBe(true);
    expect(r.repeat_quote).toBe("same as last week");
    expect(r.adjustments.map((a) => [a.op, a.product_text])).toEqual([
      ["add", "croissants"],
      ["remove", "rye"],
    ]);
  });

  it("uses the first line as the name when no name is labelled", () => {
    const r = readWithRules("Pinepour Coffee\n2 trays muffins");
    expect(r.customer_name).toBe("Pinepour Coffee");
    expect(r.lines[0]).toMatchObject({ product_text: "muffins", quantity: 2, unit_text: "trays" });
  });
});
