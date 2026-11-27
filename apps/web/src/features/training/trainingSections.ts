/** The training sections, in the order of the old LiftTrace navigation */
export const TRAINING_SECTIONS = [
  { id: "diary", path: "/training" },
  { id: "exercises", path: "/training/exercises" },
  { id: "programs", path: "/training/programs" },
  { id: "statistics", path: "/training/statistics" },
  { id: "progress", path: "/training/progress" },
  { id: "coach", path: "/training/coach" },
  { id: "coaching", path: "/training/coaching" },
  { id: "radio", path: "/training/radio" },
] as const;

export type TrainingSectionId = (typeof TRAINING_SECTIONS)[number]["id"];

export function trainingSectionOfPath(pathname: string): TrainingSectionId {
  const match = TRAINING_SECTIONS.filter(
    (section) => section.id !== "diary",
  ).find(
    (section) =>
      pathname === section.path || pathname.startsWith(`${section.path}/`),
  );
  return match?.id ?? "diary";
}
