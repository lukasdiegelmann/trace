/** `list` with the item at `index` moved by `delta`; unchanged at the ends */
export function moveItem<T>(
  list: readonly T[],
  index: number,
  delta: number,
): T[] {
  const target = index + delta;
  const next = [...list];
  if (index < 0 || index >= list.length) return next;
  if (target < 0 || target >= list.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** `list` without `value` when it holds it, else with it appended */
export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}
