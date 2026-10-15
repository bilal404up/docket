/** The fictional bakery's catalog and cafés. Everything here is invented. */
export type SeedProduct = {
  sku: string;
  name: string;
  pack: number;
  dough: string;
  doughG: number;
  aliases: string[];
};

export type SeedCustomer = {
  key: string;
  name: string;
  short: string;
  aliases: string[];
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** Standing order by SKU, used to build three weeks of history. */
  standing: Record<string, number>;
  /** SKUs whose quantity never varies in history. */
  steady?: string[];
};

export const BAKERY = { name: "Ashgrove Bakery", cutoffHour: 20 };

export const DOUGH_ORDER = ["Sourdough", "Rye", "Seeded", "Baguette", "Focaccia", "Laminated", "Sweet"];

export const PRODUCTS: SeedProduct[] = [
  { sku: "SD-L", name: "Sourdough, large", pack: 1, dough: "Sourdough", doughG: 900, aliases: ["large sourdough", "big sourdough"] },
  { sku: "SD-S", name: "Sourdough, small", pack: 1, dough: "Sourdough", doughG: 500, aliases: ["small sourdough"] },
  { sku: "RYE", name: "Rye loaf", pack: 1, dough: "Rye", doughG: 750, aliases: ["rye", "rye bread"] },
  { sku: "SEED", name: "Seeded loaf", pack: 1, dough: "Seeded", doughG: 800, aliases: ["seeded", "seeded bread"] },
  { sku: "BAG", name: "Baguette", pack: 1, dough: "Baguette", doughG: 350, aliases: ["french stick"] },
  { sku: "FOC", name: "Focaccia tray", pack: 1, dough: "Focaccia", doughG: 1600, aliases: [] },
  { sku: "CRO", name: "Croissant", pack: 1, dough: "Laminated", doughG: 90, aliases: ["butter croissant", "plain croissant"] },
  { sku: "PAC", name: "Pain au chocolat", pack: 1, dough: "Laminated", doughG: 95, aliases: ["pain au choc", "pain aux chocolat", "chocolate croissant"] },
  { sku: "ALM", name: "Almond croissant", pack: 1, dough: "Laminated", doughG: 110, aliases: [] },
  { sku: "CIN", name: "Cinnamon bun", pack: 1, dough: "Sweet", doughG: 120, aliases: ["cinnamon roll"] },
  { sku: "BAN", name: "Banana bread", pack: 1, dough: "Sweet", doughG: 700, aliases: ["banana loaf"] },
  { sku: "BRI", name: "Brioche loaf", pack: 1, dough: "Sweet", doughG: 600, aliases: ["brioche"] },
];

const MON_SAT = [1, 2, 3, 4, 5, 6];

export const CUSTOMERS: SeedCustomer[] = [
  { key: "kettle", name: "Kettle & Crumb", short: "KC", aliases: ["K&C", "Kettle and Crumb"], days: MON_SAT, standing: { "SD-L": 6, BAG: 10, CRO: 24, PAC: 12 } },
  { key: "harbor", name: "Harbor Lane Café", short: "HL", aliases: ["Harbor Lane", "Harbour Lane Cafe"], days: MON_SAT, standing: { "SD-L": 4, CRO: 24, CIN: 12 } },
  { key: "juniper", name: "Juniper Kitchen", short: "JK", aliases: ["Juniper"], days: MON_SAT, standing: { RYE: 4, BAG: 8, FOC: 2 } },
  { key: "longtable", name: "The Long Table", short: "LT", aliases: ["Long Table"], days: MON_SAT, standing: { "SD-L": 8, BAG: 12, RYE: 3, SEED: 4, CRO: 18, ALM: 6 } },
  { key: "pinepour", name: "Pine & Pour", short: "PP", aliases: ["Pine and Pour"], days: MON_SAT, standing: { CRO: 12, PAC: 12, BAN: 2 } },
  { key: "millst", name: "Mill St Deli", short: "MS", aliases: ["Mill Street Deli"], days: MON_SAT, standing: { BAG: 20, "SD-S": 6, RYE: 2 } },
  { key: "orchard", name: "Orchard Café", short: "OC", aliases: ["Orchard"], days: MON_SAT, standing: { CRO: 6, ALM: 6, CIN: 6 }, steady: ["CRO"] },
  { key: "saltbox", name: "Saltbox", short: "SB", aliases: [], days: [2, 4, 6], standing: { "SD-S": 4, FOC: 1, SEED: 2 } },
];
