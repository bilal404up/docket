"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-quiet no-print" onClick={() => window.print()}>
      Print
    </button>
  );
}
