/**
 * The name to show for an Open Food Facts product (#238), ported from
 * nutritrace/src/lib/off-name.js. First non-blank wins: the user's language
 * if they chose one other than English (the default), `product_name`, then
 * the user's, the product's main language, English and any other (sorted);
 * the same again over `generic_name`.
 */

// Longer suffixes are other fields (product_name_en_imported), not names
const LANG_SUFFIX = /^[a-z]{2}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ladder(
  product: Record<string, unknown>,
  field: string,
  language: string,
  main: string,
  isLanguageChosen: boolean,
): string {
  const tries: unknown[] = [];
  if (isLanguageChosen) tries.push(product[`${field}_${language}`]);
  tries.push(product[field]);
  if (language) tries.push(product[`${field}_${language}`]);
  if (main) tries.push(product[`${field}_${main}`]);
  tries.push(product[`${field}_en`]);
  const prefix = `${field}_`;
  for (const key of Object.keys(product).sort()) {
    if (key.startsWith(prefix) && LANG_SUFFIX.test(key.slice(prefix.length))) {
      tries.push(product[key]);
    }
  }
  for (const value of tries) {
    const found = text(value);
    if (found) return found;
  }
  return "";
}

/** "" when the product has no usable name in any language */
export function offProductName(
  product: unknown,
  language: string | null | undefined,
): string {
  if (!product || typeof product !== "object") return "";
  const record = product as Record<string, unknown>;
  const wanted = (language ?? "").toLowerCase();
  const main = (text(record.lang) || text(record.lc)).toLowerCase();
  const isLanguageChosen = wanted !== "" && wanted !== "en";
  return (
    ladder(record, "product_name", wanted, main, isLanguageChosen) ||
    ladder(record, "generic_name", wanted, main, isLanguageChosen)
  );
}
