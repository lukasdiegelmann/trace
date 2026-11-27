import { Spinner } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useResource } from "../common/useResource";
import {
  INERT_PARTS,
  levelsOf,
  MAP_MUSCLES,
  type MuscleLoad,
} from "../lib/statisticsMuscles";
import { LEVEL_CLASS_NAMES, mapMuscleLabel } from "./muscleNames";

/** Front and back of a body, each muscle shaded by how hard it worked */
// TODO(monolithium): a body map graphic
export function BodyMap({ load }: { load: MuscleLoad }) {
  const { t, i18n } = useTranslation("training");
  const geometry = useResource("body-paths", () =>
    import("../lib/statisticsBodyPaths").then((m) => m.bodyViews),
  );
  const levels = levelsOf(load);
  if (!geometry.data) return <Spinner label={t("common.loading")} />;
  const number = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  });
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["front", "back"] as const).map((side) => {
        const view = geometry.data?.[side];
        return (
          <svg
            key={side}
            viewBox={view?.vb}
            role="img"
            aria-label={t(`statistics.bodyMap.${side}`)}
            className="max-h-[28rem] w-full"
          >
            {INERT_PARTS.flatMap((part) =>
              (view?.p[part] ?? []).map((d, index) => (
                <path key={`${part}-${index}`} d={d} className="fill-fg/20" />
              )),
            )}
            {MAP_MUSCLES.flatMap((muscle) =>
              (view?.p[muscle] ?? []).map((d, index) => (
                <path
                  key={`${muscle}-${index}`}
                  d={d}
                  className={LEVEL_CLASS_NAMES[levels[muscle]]}
                >
                  <title>
                    {load[muscle]
                      ? t("statistics.bodyMap.muscle", {
                          name: mapMuscleLabel(t, muscle),
                          sets: number.format(load[muscle]),
                        })
                      : mapMuscleLabel(t, muscle)}
                  </title>
                </path>
              )),
            )}
          </svg>
        );
      })}
    </div>
  );
}
