/**
 * The diary's strings, merged into the `training` namespace
 * (src/i18n/resources.ts). One file per part, so parallel work on the
 * training feature never edits the same JSON; each part has one top-level
 * key (`diary`, `cardio`, `workoutEditor`, ...).
 */
import bodyStatsDe from "./bodyStats.de.json";
import bodyStatsEn from "./bodyStats.en.json";
import cardioDe from "./cardio.de.json";
import cardioEn from "./cardio.en.json";
import diaryDe from "./diary.de.json";
import diaryEn from "./diary.en.json";
import gymToolsDe from "./gymTools.de.json";
import gymToolsEn from "./gymTools.en.json";
import pickerDe from "./picker.de.json";
import pickerEn from "./picker.en.json";
import setVideoDe from "./setVideo.de.json";
import setVideoEn from "./setVideo.en.json";
import summaryDe from "./summary.de.json";
import summaryEn from "./summary.en.json";
import workoutEditorDe from "./workoutEditor.de.json";
import workoutEditorEn from "./workoutEditor.en.json";

export const trainingDiaryEn = {
  ...diaryEn,
  ...cardioEn,
  ...bodyStatsEn,
  ...gymToolsEn,
  ...summaryEn,
  ...setVideoEn,
  ...pickerEn,
  ...workoutEditorEn,
};

export const trainingDiaryDe = {
  ...diaryDe,
  ...cardioDe,
  ...bodyStatsDe,
  ...gymToolsDe,
  ...summaryDe,
  ...setVideoDe,
  ...pickerDe,
  ...workoutEditorDe,
};
