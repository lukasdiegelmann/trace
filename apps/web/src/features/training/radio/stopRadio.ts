import { RADIO_STATE_KEY } from "../lib/radio";
import { clearLibrary } from "./libraryCache";
import { clearQueue } from "./player";

/**
 * For sign-out and account switches: stops playback, empties the queue and
 * forgets the library and the open view.
 */
export function stopRadio(): void {
  clearQueue();
  clearLibrary();
  try {
    sessionStorage.removeItem(RADIO_STATE_KEY);
  } catch {
    // blocked storage holds nothing
  }
}
