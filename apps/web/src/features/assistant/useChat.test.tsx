import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import type * as sharedAi from "@/features/shared/ai";

import { useChat } from "./useChat";

const { askAi } = vi.hoisted(() => ({
  askAi: vi.fn<typeof sharedAi.askAi>(() => Promise.resolve("Sure.")),
}));
vi.mock("@/features/shared/ai", async (original) => ({
  ...(await original<typeof sharedAi>()),
  askAi,
  loadAiSetup: () =>
    Promise.resolve({
      assistantName: "Trace",
      shouldUseProxy: false,
      config: { provider: "claude", apiKey: "k", model: "", baseUrl: "" },
    }),
}));

describe("useChat", () => {
  it("sends the earlier turns along though the panel never opened", async () => {
    vi.spyOn(api.nt, "get").mockImplementation((path: string) =>
      Promise.resolve(
        path === "/ai/history"
          ? [
              { id: 1, role: "user", content: "Earlier question" },
              { id: 2, role: "assistant", content: "Earlier reply" },
            ]
          : {},
      ),
    );
    vi.spyOn(api.nt, "post").mockResolvedValue({});
    const onReply = vi.fn();
    const { result } = renderHook(() => useChat([], null, onReply));

    await act(() => result.current.send("From Smart Log"));

    const turns = askAi.mock.calls[0][1].messages;
    expect(turns.map((turn) => turn.content)).toEqual([
      "Earlier question",
      "Earlier reply",
      "From Smart Log",
    ]);
    expect(result.current.messages.map((m) => m.text)).toEqual([
      "Earlier question",
      "Earlier reply",
      "From Smart Log",
      "Sure.",
    ]);
  });
});
