import { useMediaQuery } from "@monocircuit/monolithium/hooks";

/** From here the Radio page has three columns and its own "now playing" */
const RADIO_WIDE_QUERY = "(min-width: 80rem)";

export function useIsRadioWide(): boolean {
  return useMediaQuery(RADIO_WIDE_QUERY);
}
