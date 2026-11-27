/**
 * Which exercise and superset cards of a day are collapsed, ported from
 * LiftTrace `src/lib/cardCollapse.js`. Three states: never touched (null),
 * collapsed, or explicitly expanded, which auto-collapse must respect.
 * The last 30 days are kept.
 */
import { safeStorage } from "./store";

const KEY = "lt:card-collapsed";
const KEPT_DAYS = 30;

export type CollapseState = "collapsed" | "expanded" | null;

type CollapseMap = Record<string, Record<string, string | boolean>>;

function read(): CollapseMap {
  return (safeStorage.read(KEY) ?? {}) as CollapseMap;
}

export function getCollapseState(date: string, rowKey: string): CollapseState {
  const map = read();
  const raw = date in map ? map[date][rowKey] : undefined;
  if (raw === "collapsed" || raw === true) return "collapsed";
  if (raw === "expanded" || raw === false) return "expanded";
  return null;
}

export function setCollapsed(
  date: string,
  rowKey: string,
  isCollapsed: boolean,
): void {
  let map = read();
  map[date] = {
    ...map[date],
    [rowKey]: isCollapsed ? "collapsed" : "expanded",
  };
  const dates = Object.keys(map).sort();
  if (dates.length > KEPT_DAYS) {
    map = Object.fromEntries(
      dates.slice(-KEPT_DAYS).map((day) => [day, map[day] ?? {}]),
    );
  }
  safeStorage.write(KEY, map);
}
