import { useEffect, useRef, useState } from "react";

/** True for a moment when `percent` reaches 100 on the same day */
export function useCelebration(
  percent: number,
  resetKey: string,
  isEnabled: boolean,
): boolean {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const previous = useRef({ percent, resetKey });
  useEffect(() => {
    const before = previous.current;
    previous.current = { percent, resetKey };
    const didCross =
      before.resetKey === resetKey && before.percent < 100 && percent >= 100;
    if (!didCross || !isEnabled) return;
    const start = setTimeout(() => {
      setIsCelebrating(true);
    }, 0);
    const stop = setTimeout(() => {
      setIsCelebrating(false);
    }, 1200);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [percent, resetKey, isEnabled]);
  return isCelebrating;
}
