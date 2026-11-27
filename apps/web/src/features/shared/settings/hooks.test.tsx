import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/api";

import { useSetting, useSettings } from "./hooks";

describe("useSetting", () => {
  it("loads the backend's value and saves a change", async () => {
    vi.spyOn(api.ct, "get").mockResolvedValue({ defaultServings: 4 });
    const put = vi.spyOn(api.ct, "put").mockResolvedValue({ ok: true });

    const { result } = renderHook(() => ({
      setting: useSetting("ct", "defaultServings"),
      all: useSettings("ct"),
    }));
    expect(result.current.setting[0]).toBe(2);

    await waitFor(() => {
      expect(result.current.setting[0]).toBe(4);
    });
    expect(result.current.all.status).toBe("ready");

    act(() => {
      result.current.setting[1](6);
    });
    expect(result.current.setting[0]).toBe(6);
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith("/settings", {
        key: "defaultServings",
        value: 6,
      });
    });
  });
});
