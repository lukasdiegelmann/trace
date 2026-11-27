import { CookingNow } from "./CookingNow";
import { TimerOverlay } from "./TimerOverlay";

/** Timers and running cooks follow the user across the whole app */
export function CookOverlays() {
  return (
    <>
      <TimerOverlay />
      <CookingNow />
    </>
  );
}
