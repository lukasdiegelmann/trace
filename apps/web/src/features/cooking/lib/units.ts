/**
 * The cooking unit catalog, ported from cooktrace/src/lib/units.js. The
 * stored value is the abbreviation; free text stays allowed everywhere.
 * A group's `label` is also what a custom unit stores as its `category`
 * (data, kept in English); `labelKey` names its translation in
 * `cookingCommon.unitGroups`.
 */

export interface Unit {
  abbr: string;
  full: string;
}

export interface UnitGroup {
  label: string;
  labelKey: string;
  units: Unit[];
}

const u = (abbr: string, full: string = abbr): Unit => ({ abbr, full });

export const UNIT_GROUPS: readonly UnitGroup[] = [
  {
    label: "Volume — US",
    labelKey: "volumeUs",
    units: [
      u("tsp", "teaspoon"),
      u("tbsp", "tablespoon"),
      u("fl oz", "fluid ounce"),
      u("cup"),
      u("pt", "pint"),
      u("qt", "quart"),
      u("gal", "gallon"),
    ],
  },
  {
    label: "Volume — Metric",
    labelKey: "volumeMetric",
    units: [
      u("ml", "milliliter"),
      u("cl", "centiliter"),
      u("dl", "deciliter"),
      u("l", "liter"),
    ],
  },
  {
    label: "Weight — US",
    labelKey: "weightUs",
    units: [u("oz", "ounce"), u("lb", "pound")],
  },
  {
    label: "Weight — Metric",
    labelKey: "weightMetric",
    units: [u("mg", "milligram"), u("g", "gram"), u("kg", "kilogram")],
  },
  {
    label: "Count / descriptive",
    labelKey: "count",
    units: [
      u("pc", "piece"),
      u("whole"),
      u("clove"),
      u("sprig"),
      u("slice"),
      u("stick"),
      u("pinch"),
      u("dash"),
      u("drop"),
      u("splash"),
      u("handful"),
      u("bunch"),
      u("head"),
      u("stalk"),
      u("can"),
      u("jar"),
      u("bottle"),
      u("pkg", "package"),
      u("box"),
      u("bag"),
      u("to taste"),
    ],
  },
];

export const CUSTOM_UNIT_CATEGORY = "Custom";

/** Every built-in abbreviation */
export const BUILTIN_UNIT_ABBRS: ReadonlySet<string> = new Set(
  UNIT_GROUPS.flatMap((group) => group.units.map((unit) => unit.abbr)),
);

export interface CustomUnit {
  id: number;
  abbr: string;
  full_name: string | null;
  category: string | null;
}

export interface UnitsOverlay {
  disabled?: readonly string[];
  custom?: readonly CustomUnit[];
  /** Uses per lowercase abbreviation, built-in and custom */
  usage?: Record<string, number>;
}

/**
 * The built-ins without the disabled ones, plus custom units: in the group
 * their category names, else in a "Custom" group at the top.
 */
export function unitGroupsMerged(
  overlay: UnitsOverlay | null | undefined,
): UnitGroup[] {
  const disabled = new Set((overlay?.disabled ?? []).map(String));
  const customs = overlay?.custom ?? [];
  const byCategory = new Map<string, Unit[]>();
  const loose: Unit[] = [];
  for (const custom of customs) {
    const unit = { abbr: custom.abbr, full: custom.full_name || custom.abbr };
    const category = (custom.category ?? "").trim();
    if (!category || category === CUSTOM_UNIT_CATEGORY) {
      loose.push(unit);
      continue;
    }
    const list = byCategory.get(category);
    if (list) list.push(unit);
    else byCategory.set(category, [unit]);
  }
  const groups: UnitGroup[] = [];
  for (const group of UNIT_GROUPS) {
    const remaining = group.units.filter((unit) => !disabled.has(unit.abbr));
    const merged = [...remaining, ...(byCategory.get(group.label) ?? [])];
    if (merged.length > 0) groups.push({ ...group, units: merged });
    byCategory.delete(group.label);
  }
  for (const list of byCategory.values()) loose.push(...list);
  if (loose.length > 0) {
    groups.unshift({
      label: CUSTOM_UNIT_CATEGORY,
      labelKey: "custom",
      units: loose,
    });
  }
  return groups;
}

/**
 * `measurementSystem` "metric" lists the metric groups ahead of the US ones;
 * the Custom group stays on top.
 */
export function orderUnitGroups(
  groups: readonly UnitGroup[],
  measurementSystem: string,
): UnitGroup[] {
  if (measurementSystem !== "metric") return [...groups];
  const rank = (group: UnitGroup) => {
    if (group.label === CUSTOM_UNIT_CATEGORY) return 0;
    return group.label.includes("Metric") ? 1 : 2;
  };
  return [...groups].sort((a, b) => rank(a) - rank(b));
}

/** The translation key of a stored group label (`category`) */
export function unitGroupLabelKey(label: string): string | undefined {
  if (label === CUSTOM_UNIT_CATEGORY) return "custom";
  return UNIT_GROUPS.find((group) => group.label === label)?.labelKey;
}
