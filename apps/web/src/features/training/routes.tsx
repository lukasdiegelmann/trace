import type { RouteObject } from "react-router";

import { CoachingPage } from "./coaching/CoachingPage";
import { CoachPage } from "./coaching/CoachPage";
import { ExerciseDetailPage } from "./exercises/ExerciseDetailPage";
import { ExercisesPage } from "./exercises/ExercisesPage";
import { ProgramDetailPage } from "./programs/ProgramDetailPage";
import { ProgramsPage } from "./programs/ProgramsPage";
import { ProgressPage } from "./progress/ProgressPage";
import { RadioPage } from "./radio/RadioPage";
import { StatisticsPage } from "./statistics/StatisticsPage";
import { TrainingLayout } from "./TrainingLayout";

/** Mounted under /training by src/router.tsx */
export const trainingRoutes: RouteObject[] = [
  {
    element: <TrainingLayout />,
    children: [
      // The diary and the template editor are large, so they load on demand
      {
        index: true,
        lazy: async () => ({
          Component: (await import("./diary/DiaryPage")).DiaryPage,
        }),
      },
      { path: "exercises", element: <ExercisesPage /> },
      { path: "exercises/:id", element: <ExerciseDetailPage /> },
      { path: "programs", element: <ProgramsPage /> },
      { path: "programs/:id", element: <ProgramDetailPage /> },
      {
        path: "programs/:programId/template/:templateId",
        lazy: async () => ({
          Component: (await import("./workoutEditor/WorkoutEditorPage"))
            .WorkoutEditorPage,
        }),
      },
      { path: "statistics", element: <StatisticsPage /> },
      { path: "progress", element: <ProgressPage /> },
      { path: "coach", element: <CoachPage /> },
      { path: "coaching", element: <CoachingPage /> },
      { path: "coaching/:memberId", element: <CoachingPage /> },
      { path: "radio", element: <RadioPage /> },
    ],
  },
];
