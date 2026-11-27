import { useTranslation } from "react-i18next";

import { useShared } from "../common/binding";
import { TextRow } from "../common/fields";
import { mealTimesFor, setMealTime } from "../lib/mealTimes";
import { stringList } from "../lib/lists";

/** One reminder time per meal of the diary */
export function MealTimes() {
  const { t } = useTranslation("settings");
  const [names] = useShared<unknown>(["nt", "mealNames"]);
  const [stored, setStored] = useShared<unknown>(["nt", "notifMealTimes"]);
  const meals = stringList(names);
  const times = mealTimesFor(meals.length, stored);
  return (
    <>
      {meals.map((meal, index) => (
        <TextRow
          key={`${meal}-${index}`}
          type="time"
          label={t("notifications.nutrition.mealTime", { meal })}
          value={times[index] ?? ""}
          onCommit={(value) => {
            setStored(setMealTime(times, index, value));
          }}
        />
      ))}
    </>
  );
}
