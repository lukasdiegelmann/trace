/**
 * The provider presets of the old UIs (SettingsAuth.svelte): what a new
 * provider starts with. Their help texts are in the locales.
 */
export interface OidcPreset {
  id:
    | "auth0"
    | "authelia"
    | "authentik"
    | "google"
    | "keycloak"
    | "pocket-id"
    | "custom";
  name: string;
  scope: string;
  authMethod: "client_secret_post" | "client_secret_basic" | "none";
  adminGroupClaim: string;
  displayName: string;
  logoUrl: string;
  issuerHint: string;
  /** Google has no group claims: the admin mapping fields are hidden */
  hasGroups: boolean;
}

function preset(
  id: OidcPreset["id"],
  name: string,
  issuerHint: string,
  rest: Partial<OidcPreset> = {},
): OidcPreset {
  return {
    id,
    name,
    issuerHint,
    scope: "openid profile email",
    authMethod: "client_secret_post",
    adminGroupClaim: "",
    displayName: name,
    logoUrl: "",
    hasGroups: true,
    ...rest,
  };
}

export const OIDC_PRESETS: readonly OidcPreset[] = [
  preset("auth0", "Auth0", "https://<your-tenant>.auth0.com/", {
    logoUrl: "https://cdn.simpleicons.org/auth0/EB5424",
  }),
  preset("authelia", "Authelia", "https://auth.example.com", {
    scope: "openid profile email groups",
    adminGroupClaim: "groups",
    logoUrl: "https://cdn.simpleicons.org/authelia/000000",
  }),
  preset(
    "authentik",
    "Authentik",
    "https://auth.example.com/application/o/<your-app-slug>/",
    { adminGroupClaim: "groups", logoUrl: "/icons/sso/authentik.svg" },
  ),
  preset("google", "Google", "https://accounts.google.com", {
    logoUrl: "https://cdn.simpleicons.org/google/4285F4",
    hasGroups: false,
  }),
  preset(
    "keycloak",
    "Keycloak",
    "https://auth.example.com/realms/<your-realm>",
    {
      authMethod: "client_secret_basic",
      adminGroupClaim: "groups",
      logoUrl: "https://cdn.simpleicons.org/keycloak/4D4D4D",
    },
  ),
  preset("pocket-id", "Pocket ID", "https://id.example.com", {
    scope: "openid profile email groups",
    adminGroupClaim: "groups",
    logoUrl: "/icons/sso/pocket-id.svg",
  }),
  preset("custom", "OpenID Connect", "https://your-idp.example.com", {
    displayName: "",
  }),
];

export const CUSTOM_PRESET = OIDC_PRESETS[OIDC_PRESETS.length - 1];

/** What else gives a provider away (the old _detectPreset) */
const NAME_HINTS: Partial<Record<OidcPreset["id"], readonly string[]>> = {
  auth0: [".auth0.com"],
  authentik: ["/application/o/"],
  google: ["accounts.google"],
  keycloak: ["/realms/"],
  "pocket-id": ["pocket"],
};

/** Which preset an existing provider looks like, from its name and issuer */
export function detectPreset(
  displayName: string | null | undefined,
  issuer: string,
): OidcPreset {
  const haystack = `${displayName ?? ""} ${issuer}`.toLowerCase();
  const match = OIDC_PRESETS.find(
    (candidate) =>
      candidate.id !== "custom" &&
      [
        candidate.id,
        candidate.name.toLowerCase(),
        ...(NAME_HINTS[candidate.id] ?? []),
      ].some((hint) => haystack.includes(hint)),
  );
  return match ?? CUSTOM_PRESET;
}
