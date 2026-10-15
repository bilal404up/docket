"use client";

import type { SourceRef, TextLayer } from "@/lib/types";
import { cx } from "@/lib/cx";

type Props = {
  layer: TextLayer;
  imageUrl?: string | null;
  active?: SourceRef | null;
  className?: string;
};

/* Draws a document from its saved text layer. PDFs are drawn as SVG text stretched to the
   exact box the reader found, so a highlight always sits on the words it points to. */
export function DocViewer({ layer, imageUrl, active, className }: Props) {
  if (imageUrl) {
    return (
      <div className={cx("overflow-hidden rounded-control border border-line bg-paper", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="A photographed order form" className="block h-auto w-full" />
        {active && active.kind !== "none" ? (
          <p className="border-t border-line bg-ember-tint px-3 py-2 text-sm text-ember-deep">
            Reading from: <span className="mono">{active.quote}</span>. A photo has no text layer, so there is no box to draw.
          </p>
        ) : null}
      </div>
    );
  }

  if (layer.kind === "pages") {
    return (
      <div className={cx("grid gap-3", className)}>
        {layer.pages.map((page, p) => {
          const box = active && active.kind === "box" && active.page === p ? active : null;
          return (
            <svg
              key={p}
              viewBox={`0 0 ${page.width} ${page.height}`}
              role="img"
              aria-label={`Page ${p + 1} of the document`}
              className="block h-auto w-full rounded-control border border-line bg-white"
            >
              {(page.rules ?? []).map((r, i) => (
                <line key={i} x1={r.x1 * page.width} y1={r.y1 * page.height} x2={r.x2 * page.width} y2={r.y2 * page.height} stroke="#2b2d33" strokeWidth="0.75" />
              ))}
              {box ? (
                <rect
                  x={box.x * page.width - 3}
                  y={box.y * page.height - 1}
                  width={box.w * page.width + 6}
                  height={box.h * page.height + 2}
                  rx="3"
                  fill="#C2410C"
                  fillOpacity="0.2"
                  stroke="#C2410C"
                  strokeWidth="1.5"
                  className="hl-pulse"
                />
              ) : null}
              {page.runs.map((r, i) => {
                const size = r.s ?? 10;
                return (
                  <text
                    key={i}
                    x={r.x * page.width}
                    y={r.y * page.height + size * 0.95}
                    fontSize={size}
                    fontWeight={r.b ? 700 : 400}
                    fontFamily="Helvetica, Arial, sans-serif"
                    fill="#14151a"
                    textLength={r.w > 0 ? r.w * page.width : undefined}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {r.t}
                  </text>
                );
              })}
            </svg>
          );
        })}
      </div>
    );
  }

  if (layer.kind === "text") {
    const t = layer.text;
    const span = active && active.kind === "span" ? active : null;
    return (
      <pre className={cx("whitespace-pre-wrap break-words rounded-control border border-line bg-white p-4 font-mono text-[13px] leading-6", className)}>
        {span ? (
          <>
            {t.slice(0, span.start)}
            <mark className="hl-pulse rounded-tag bg-ember-tint px-0.5 text-ink ring-1 ring-ember">{t.slice(span.start, span.end)}</mark>
            {t.slice(span.end)}
          </>
        ) : (
          t
        )}
      </pre>
    );
  }

  return <p className="rounded-control border border-line bg-white p-4 text-sm text-ink-muted">There is nothing to show for this document.</p>;
}
