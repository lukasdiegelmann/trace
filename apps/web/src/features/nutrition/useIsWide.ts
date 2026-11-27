import { useNtSettings } from "./settings";
import { useMediaQuery } from "./useMediaQuery";

/** Room for a side column (the old UI's desktop layout), unless the user forced the phone layout */
export function useIsWide(): boolean {
  const { settings } = useNtSettings();
  const isWideScreen = useMediaQuery("(min-width: 1280px)");
  return isWideScreen && !settings.forceMobileLayout;
}
