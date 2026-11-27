export interface PantryRow {
  id: number;
  name: string;
  generic_parent_id?: number | null;
}

/** Pantry rows a variant can hang under: the ones that are no variant */
export function genericParents(
  rows: readonly PantryRow[],
  genericText: string,
): { id: number; label: string }[] {
  const withVariants = new Set(rows.map((row) => row.generic_parent_id));
  return rows
    .filter((row) => row.generic_parent_id == null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => ({
      id: row.id,
      label: withVariants.has(row.id)
        ? `${row.name} (${genericText})`
        : row.name,
    }));
}
