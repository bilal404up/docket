import { loadCatalogPage } from "@/lib/data/catalog";
import { daysList } from "@/lib/pipeline/dates";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Catalog" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const { sb, ws } = await currentWorkspace();
  if (!ws) return null;
  const { products, customers } = await loadCatalogPage(sb, ws.id);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-1 text-sm text-ink-muted">The products, the names each café uses for them, and when each café is served. Aliases are learned when you tick &ldquo;Remember this café&rsquo;s wording&rdquo; on a review.</p>
      </div>

      <section aria-labelledby="prod" className="grid gap-2">
        <h2 id="prod" className="label">Products</h2>
        <ul className="card divide-y divide-line">
          {products.map((p) => (
            <li key={p.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-ink-muted">
                  <span className="mono">{p.sku}</span> · {p.dough} dough · {p.active ? "active" : "paused"}
                </p>
                {p.aliases.length ? (
                  <p className="mt-1 text-sm text-ink-muted">
                    Also written as: {p.aliases.map((a) => (a.customer ? `${a.alias} (${a.customer}, learned)` : a.alias)).join(", ")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cafes" className="grid gap-2">
        <h2 id="cafes" className="label">Cafés</h2>
        <ul className="card divide-y divide-line">
          {customers.map((c) => (
            <li key={c.id} className="grid gap-1 p-4">
              <p className="font-semibold">
                {c.name} <span className="mono text-xs text-ink-muted">{c.short}</span>
              </p>
              <p className="text-sm text-ink-muted">
                Delivery: {daysList(c.days)}. Also called: {c.aliases.join(", ") || "none"}.
              </p>
              <p className="text-xs text-ink-muted">Last approved order: {c.lastOrder ?? "none yet"}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
