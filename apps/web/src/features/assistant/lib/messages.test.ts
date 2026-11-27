import { describe, expect, it } from "vitest";

import { isSameConversation, type ChatMessage } from "./messages";

const message = (
  role: ChatMessage["role"],
  text: string,
  rest: Partial<ChatMessage> = {},
): ChatMessage => ({ id: text, role, text, time: 0, ...rest });

describe("isSameConversation", () => {
  const history = [
    message("user", "What is this? (image attached)"),
    message("assistant", "A pear."),
  ];

  it("keeps the screen's photos, notes and errors", () => {
    const shown = [
      message("user", "What is this?", { images: ["data:image/png;base64,x"] }),
      message("note", "No tools"),
      message("assistant", "A pear."),
      message("assistant", "Offline", { isError: true }),
    ];
    expect(isSameConversation(shown, history)).toBe(true);
  });

  it("takes the server's history when it says something else", () => {
    expect(isSameConversation([], history)).toBe(false);
    expect(isSameConversation(history, [])).toBe(false);
    expect(
      isSameConversation(history, [...history, message("user", "More")]),
    ).toBe(false);
  });
});
