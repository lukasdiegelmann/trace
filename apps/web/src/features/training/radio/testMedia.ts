/** jsdom plays nothing: enough of a media element for the player's tests */
import { vi } from "vitest";

export function stubMedia() {
  const isStopped = new WeakSet<HTMLMediaElement>();
  const playing = new WeakSet<HTMLMediaElement>();
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(function (this: HTMLMediaElement) {
      playing.add(this);
      isStopped.delete(this);
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    const didStop = playing.delete(this);
    if (didStop) this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(
    function (this: HTMLMediaElement) {
      return !playing.has(this);
    },
  );
  return { play };
}

export function mainAudio(): HTMLAudioElement {
  const element = document.querySelector<HTMLAudioElement>(
    'audio[data-player="main"]',
  );
  if (!element) throw new Error("nothing has played yet");
  return element;
}
