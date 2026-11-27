/**
 * Barcodes, ported from `_normBarcode` and `handleScan` in
 * nutritrace/src/routes/{Foods,FoodEditor}.svelte.
 */

/** A scanned 12-digit UPC-A as the EAN-13 product databases store */
export function normalizeScannedBarcode(raw: string): string {
  const code = raw.trim();
  return /^\d{12}$/.test(code) ? `0${code}` : code;
}

/** For comparing only: scanners disagree on leading zeros */
export function barcodeKey(barcode: string | null | undefined): string {
  return (barcode ?? "").trim().replace(/^0+/, "");
}

export function isSameBarcode(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const key = barcodeKey(a);
  return key !== "" && key === barcodeKey(b);
}

export function findByBarcode<T extends { barcode?: string | null }>(
  items: readonly T[],
  barcode: string | null | undefined,
): T | null {
  return items.find((item) => isSameBarcode(item.barcode, barcode)) ?? null;
}
