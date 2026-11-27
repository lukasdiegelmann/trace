import { describe, expect, it } from "vitest";

import {
  markupToRichText,
  richTextToMarkup,
  sanitizeRichText,
} from "./richText";

describe("sanitizeRichText", () => {
  it("keeps the editor's tags and hex colours only", () => {
    expect(
      sanitizeRichText(
        '<p onclick="x()"><b class="a">Hi</b> <font color="#ff0000">red</font></p>',
      ),
    ).toBe('<p><b>Hi</b> <span style="color: #ff0000">red</span></p>');
  });

  it("also checks the children of an unwrapped tag", () => {
    expect(sanitizeRichText('<x><img src="y" onerror="a()"></x>text')).toBe(
      "text",
    );
    expect(sanitizeRichText("<div><script>a()</script>ok</div>")).toBe(
      "<div>ok</div>",
    );
  });

  it("is empty without text", () => {
    expect(sanitizeRichText("<div><br></div>")).toBe("");
    expect(sanitizeRichText(null)).toBe("");
  });
});

describe("markup", () => {
  const html =
    '<strong>Bold</strong> <em>it</em> <u>under</u> <s>gone</s> <span style="color: #ef4444">red</span><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>';

  it("goes to text and back without losing formatting", () => {
    const markup = richTextToMarkup(html);
    expect(markup).toBe(
      "**Bold** *it* __under__ ~~gone~~ [red]{#ef4444}\n- one\n- two\n1. first",
    );
    expect(markupToRichText(markup)).toBe(html);
  });

  it("keeps plain notes and arithmetic", () => {
    expect(markupToRichText("a\n\n2 * 3 * 4 < 30")).toBe(
      "a<br><br>2 * 3 * 4 &lt; 30",
    );
    expect(richTextToMarkup("line one\nline two")).toBe("line one\nline two");
  });
});
