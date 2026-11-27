import { describe, expect, it } from "vitest";

import { mergedProfile } from "./profile";

describe("mergedProfile", () => {
  it("keeps what any app has, so saving doesn't erase it", () => {
    expect(
      mergedProfile([
        { full_name: "A B", birthday: null, gender: "" },
        null,
        { nickname: "ab", birthday: "1990-05-15", gender: "female" },
      ]),
    ).toEqual({
      full_name: "A B",
      nickname: "ab",
      email: "",
      birthday: "1990-05-15",
      gender: "female",
    });
  });

  it("reads each app's spelling of a gender and prefers the first", () => {
    expect(
      mergedProfile([{ gender: "Non-binary" }, { gender: "male" }]).gender,
    ).toBe("non-binary");
    expect(mergedProfile([]).gender).toBe("");
  });
});
