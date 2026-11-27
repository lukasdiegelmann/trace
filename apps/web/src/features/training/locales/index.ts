/**
 * The strings of the screens ported with #8, one file per area under
 * parts/ so parallel work never edits the same JSON. Each part has its own
 * top-level keys; src/i18n/resources.ts merges them into `training`.
 */
import coachingDe from "./parts/coaching.de.json";
import coachingEn from "./parts/coaching.en.json";
import exercisesDe from "./parts/exercises.de.json";
import exercisesEn from "./parts/exercises.en.json";
import programsDe from "./parts/programs.de.json";
import programsEn from "./parts/programs.en.json";
import progressDe from "./parts/progress.de.json";
import progressEn from "./parts/progress.en.json";
import radioDe from "./parts/radio.de.json";
import radioEn from "./parts/radio.en.json";
import statisticsDe from "./parts/statistics.de.json";
import statisticsEn from "./parts/statistics.en.json";

export const trainingAreasEn = {
  ...exercisesEn,
  ...programsEn,
  ...statisticsEn,
  ...progressEn,
  ...coachingEn,
  ...radioEn,
};

export const trainingAreasDe = {
  ...exercisesDe,
  ...programsDe,
  ...statisticsDe,
  ...progressDe,
  ...coachingDe,
  ...radioDe,
};
