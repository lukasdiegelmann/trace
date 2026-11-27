import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyDevice } from "./notify";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNotification(permission: string) {
  const shown = vi.fn();
  vi.stubGlobal(
    "Notification",
    Object.assign(
      function Notification(title: string) {
        shown(title);
      },
      { permission },
    ),
  );
  return shown;
}

describe("notifyDevice", () => {
  it("shows a device notification once permitted", async () => {
    const shown = stubNotification("granted");
    const push = vi.fn(() => Promise.resolve());
    await notifyDevice(
      "Done",
      "16h",
      { hasLocal: true, pushService: "none" },
      push,
    );
    expect(shown).toHaveBeenCalledWith("Done");
    expect(push).not.toHaveBeenCalled();
  });

  it("stays quiet without permission and still pushes", async () => {
    const shown = stubNotification("default");
    const push = vi.fn(() => Promise.reject(new Error("offline")));
    await notifyDevice(
      "Done",
      "16h",
      { hasLocal: true, pushService: "ntfy" },
      push,
    );
    expect(shown).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({
      service: "ntfy",
      title: "Done",
      message: "16h",
      priority: 5,
    });
  });

  it("respects the switched-off device notifications", async () => {
    const shown = stubNotification("granted");
    await notifyDevice(
      "Done",
      "16h",
      { hasLocal: false, pushService: "none" },
      vi.fn(),
    );
    expect(shown).not.toHaveBeenCalled();
  });
});
