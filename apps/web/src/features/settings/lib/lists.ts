/** The list with the item at `from` moved to `to` */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The ids in the stored order: stored ones first (unknown ones skipped),
 * every id the order doesn't list appended in its built-in order.
 */
export function orderedIds(all: readonly string[], stored: unknown): string[] {
  const order = Array.isArray(stored)
    ? stored.filter(
        (id): id is string => typeof id === "string" && all.includes(id),
      )
    : [];
  const unique = [...new Set(order)];
  return [...unique, ...all.filter((id) => !unique.includes(id))];
}

/** `list` with `item` switched on or off, appended at the end when on */
export function toggleItem<T>(list: readonly T[], item: T, isOn: boolean): T[] {
  const without = list.filter((candidate) => candidate !== item);
  return isOn ? [...without, item] : without;
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
