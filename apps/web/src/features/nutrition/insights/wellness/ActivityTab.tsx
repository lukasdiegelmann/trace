import type { Workout } from "../api";
import { MetricTiles } from "./MetricTiles";
import type { MetricTabProps } from "./tabProps";
import { WorkoutList } from "./Workouts";

export interface ActivityTabProps extends MetricTabProps {
  workouts: Workout[];
  onOpenWorkout: (workout: Workout) => void;
}

export function ActivityTab({
  workouts,
  onOpenWorkout,
  ...props
}: ActivityTabProps) {
  return (
    <>
      <MetricTiles {...props} group="activity" />
      {workouts.length ? (
        <WorkoutList
          workouts={workouts}
          distUnit={props.format.distUnit}
          energyUnit={props.format.energyUnit}
          onOpen={onOpenWorkout}
        />
      ) : null}
    </>
  );
}
