import { diaryApi, wellnessApi } from "../api";
import { newerWeight, type WeightReading } from "../lib/activity";
import { readBodyStat, weightToKg } from "../lib/bodyStats";
import { useNtSettings } from "../settings";
import { useResource } from "../useResource";

/**
 * The body weight the calorie estimate uses: the newest of the diary's and
 * the scale's readings, else the weight given at setup. In kg.
 */
export function useActivityWeight(): number | null {
  const { settings } = useNtSettings();
  const unit = settings.weightUnit;
  const latest = useResource(`weight-${unit}`, async () => {
    const [days, scale] = await Promise.all([
      diaryApi.all().catch(() => []),
      wellnessApi.latest("weight_kg").catch(() => null),
    ]);
    let diary: WeightReading | null = null;
    for (const day of days) {
      const value = readBodyStat(day.body_stats, "weight", unit, "cm");
      if (value === null || value <= 0) continue;
      if (!diary || day.date > diary.date) {
        diary = { kg: weightToKg(value, unit), date: day.date };
      }
    }
    return newerWeight(
      diary,
      scale ? { kg: scale.value, date: scale.date } : null,
    );
  });
  return latest.data?.kg ?? (Number(settings.weight_kg) || null);
}
