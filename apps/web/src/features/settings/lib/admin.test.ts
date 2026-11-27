import { describe, expect, it } from "vitest";

import {
  defaultScopes,
  isEmail,
  SECRET_MASK,
  smtpWrites,
  tokenExpiry,
} from "./admin";
import { isInCoaching, showsCoachTab } from "./coaching";
import {
  draftFromPreset,
  draftFromProvider,
  isDraftComplete,
} from "./oidcDraft";
import { CUSTOM_PRESET, detectPreset } from "./oidcPresets";
import { connectionName } from "./ntLink";

describe("API tokens", () => {
  it("writes the expiry as the servers store it", () => {
    const now = Date.UTC(2026, 0, 1, 12, 30, 5);
    expect(tokenExpiry(30, now)).toBe("2026-01-31 12:30:05");
    expect(tokenExpiry(null, now)).toBeNull();
    expect(tokenExpiry(0, now)).toBeNull();
  });

  it("preselects only a scope the app knows", () => {
    expect(defaultScopes(["read:recipes", "mcp:read"])).toEqual([
      "read:recipes",
    ]);
    expect(defaultScopes(["mcp:read"])).toEqual([]);
  });
});

describe("SMTP", () => {
  const form = {
    smtp_host: "mail",
    smtp_port: "587",
    smtp_secure: "true",
    smtp_user: "u",
    smtp_pass: "",
    smtp_from: "a@b.de",
  };
  it("never overwrites the stored password with nothing or the mask", () => {
    for (const smtp_pass of ["", SECRET_MASK]) {
      expect(
        smtpWrites({ ...form, smtp_pass }).map((w) => w.key),
      ).not.toContain("smtp_pass");
    }
    expect(smtpWrites({ ...form, smtp_pass: "new" })).toContainEqual({
      key: "smtp_pass",
      value: "new",
    });
    expect(isEmail(" a@b.de ")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
  });
});

describe("sign-in providers", () => {
  it("recognises a preset from name and issuer", () => {
    expect(detectPreset("Keycloak", "https://auth.example.com").id).toBe(
      "keycloak",
    );
    expect(detectPreset("SSO", "https://x.example/realms/home").id).toBe(
      "keycloak",
    );
    expect(detectPreset(null, "https://accounts.google.com").id).toBe("google");
    expect(detectPreset("Corp", "https://idp.example").id).toBe("custom");
  });

  it("keeps the old UI's hints for Authentik and Pocket ID", () => {
    expect(
      detectPreset("Home", "https://x.example/application/o/trace/").id,
    ).toBe("authentik");
    expect(detectPreset("Pocket", "https://id.example").id).toBe("pocket-id");
    expect(detectPreset("SSO", "https://x.eu.auth0.com/").id).toBe("auth0");
  });

  it("keeps the secret empty when editing", () => {
    const draft = draftFromPreset(CUSTOM_PRESET, "https://t/cb");
    expect(isDraftComplete(draft)).toBe(false);
    expect(
      isDraftComplete({ ...draft, issuer_url: "https://i", client_id: "c" }),
    ).toBe(true);
    expect(
      draftFromProvider({
        id: 1,
        issuer_url: "https://i",
        client_id: "c",
        redirect_uris: ["x"],
        has_client_secret: true,
        is_active: 1,
      }),
    ).toMatchObject({ client_secret: "", is_active: true });
  });
});

describe("coaching", () => {
  it("follows LiftTrace's rules", () => {
    expect(isInCoaching(null)).toBe(false);
    expect(showsCoachTab({ requests: [1] })).toBe(true);
    expect(isInCoaching({ role: "trainer" })).toBe(true);
    expect(isInCoaching({ role: "admin" })).toBe(false);
    expect(isInCoaching({ role: "admin", as_coach: { recent: 1 } })).toBe(true);
    expect(isInCoaching({ role: "member", as_coach: { active: 1 } })).toBe(
      false,
    );
  });
});

describe("NutriTrace link", () => {
  it("is named after the account, else after the host", () => {
    const url = "https://trace.example/nt";
    expect(connectionName({ ok: true, user: { username: "a" } }, url)).toBe(
      "a",
    );
    expect(connectionName({ ok: true, user: null }, url)).toBe("trace.example");
    expect(connectionName({ ok: true }, "not a url")).toBe("not a url");
  });
});
