import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFab, type FabOptions } from "./useFab";

function Fab(options: FabOptions) {
  const fab = useFab(options);
  return (
    <div data-testid="wrapper" {...fab.handlers}>
      {/* eslint-disable-next-line no-restricted-syntax -- a bare stand-in */}
      <button type="button" onClick={fab.onClick}>
        {fab.recording ? "recording" : "fab"}
      </button>
    </div>
  );
}

function setup(canRecord = false) {
  const options = {
    canRecord,
    shouldBeep: false,
    voiceLanguage: "en-US",
    onTap: vi.fn(),
    onRecorded: vi.fn(),
    onProblem: vi.fn(),
  };
  render(<Fab {...options} />);
  const wrapper = screen.getByTestId("wrapper");
  return { options, wrapper, button: screen.getByRole("button") };
}

const at = (x: number, y: number) => ({
  button: 0,
  pointerId: 1,
  clientX: x,
  clientY: y,
});

describe("useFab", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on a plain click", () => {
    const { options, wrapper, button } = setup();
    fireEvent.pointerDown(wrapper, at(10, 10));
    fireEvent.pointerMove(window, at(12, 11));
    fireEvent.pointerUp(window, at(12, 11));
    fireEvent.click(button);
    expect(options.onTap).toHaveBeenCalledTimes(1);
  });

  it("follows a drag that left the button, and that is no tap", () => {
    const { options, wrapper, button } = setup();
    const before = window.innerWidth;
    fireEvent.pointerDown(wrapper, at(before - 40, 700));
    // Far outside the button at once: only the window hears it.
    fireEvent.pointerMove(window, at(before - 240, 500));
    fireEvent.pointerUp(window, at(before - 240, 500));
    fireEvent.click(button);
    expect(options.onTap).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem("trace.assistantFab") ?? "{}"),
    ).toMatchObject({ right: 216 });
    // The gesture is over: later moves change nothing.
    fireEvent.pointerMove(window, at(0, 0));
    fireEvent.click(button);
    expect(options.onTap).toHaveBeenCalledTimes(1);
  });

  it("reports a browser without voice input when held", () => {
    vi.useFakeTimers();
    const { options, wrapper } = setup(true);
    fireEvent.pointerDown(wrapper, at(10, 10));
    vi.advanceTimersByTime(800);
    expect(options.onProblem).toHaveBeenCalled();
  });
});
