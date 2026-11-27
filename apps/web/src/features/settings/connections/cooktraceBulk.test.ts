import { describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/api";

import { cooktraceGet, pantryRefusal } from "./cooktraceBulk";

describe("CookTrace through NutriTrace's proxy", () => {
  it("doesn't take CookTrace's 401 for the end of the session", async () => {
    const post = vi.spyOn(api.nt, "post").mockResolvedValue({});
    await cooktraceGet({ baseUrl: "https://ct/", token: "t" }, "/api/v1/me");
    expect(post).toHaveBeenCalledWith(
      "/cooktrace/proxy",
      { baseUrl: "https://ct", token: "t", path: "/api/v1/me" },
      { shouldVerify401: true },
    );
  });

  it("names why the pantry was refused", () => {
    const refused = (status: number) =>
      pantryRefusal(new ApiError("nt", status, {}));
    expect(refused(403)).toBe("scope");
    expect(refused(404)).toBe("oldServer");
    expect(refused(401)).toBe("token");
    expect(refused(500)).toBeNull();
    expect(pantryRefusal(new Error("offline"))).toBeNull();
  });
});
