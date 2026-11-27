/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import type { OidcPreset } from "./oidcPresets";

export interface OidcProvider {
  id: number;
  issuer_url: string;
  client_id: string;
  has_client_secret?: boolean;
  redirect_uris: string[];
  scope?: string | null;
  token_endpoint_auth_method?: string | null;
  auto_link_verified_email?: boolean | number;
  auto_register_new_users?: boolean | number;
  admin_group_claim?: string | null;
  admin_group_value?: string | null;
  display_name?: string | null;
  logo_url?: string | null;
  is_active?: boolean | number;
  env_locked?: boolean;
}

/** The form: every field a value, the secret empty (kept when left empty) */
export interface ProviderDraft {
  id?: number;
  issuer_url: string;
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  scope: string;
  token_endpoint_auth_method: string;
  auto_link_verified_email: boolean;
  auto_register_new_users: boolean;
  admin_group_claim: string;
  admin_group_value: string;
  display_name: string;
  logo_url: string;
  is_active: boolean;
}

export function draftFromPreset(
  preset: OidcPreset,
  redirectUri: string,
): ProviderDraft {
  return {
    issuer_url: "",
    client_id: "",
    client_secret: "",
    redirect_uris: [redirectUri],
    scope: preset.scope,
    token_endpoint_auth_method: preset.authMethod,
    auto_link_verified_email: true,
    auto_register_new_users: false,
    admin_group_claim: preset.adminGroupClaim,
    admin_group_value: "",
    display_name: preset.displayName,
    logo_url: preset.logoUrl,
    is_active: true,
  };
}

export function draftFromProvider(provider: OidcProvider): ProviderDraft {
  return {
    id: provider.id,
    issuer_url: provider.issuer_url,
    client_id: provider.client_id,
    client_secret: "",
    redirect_uris: [...provider.redirect_uris],
    scope: provider.scope ?? "openid profile email",
    token_endpoint_auth_method:
      provider.token_endpoint_auth_method ?? "client_secret_post",
    auto_link_verified_email: Boolean(provider.auto_link_verified_email),
    auto_register_new_users: Boolean(provider.auto_register_new_users),
    admin_group_claim: provider.admin_group_claim ?? "",
    admin_group_value: provider.admin_group_value ?? "",
    display_name: provider.display_name ?? "",
    logo_url: provider.logo_url ?? "",
    is_active: Boolean(provider.is_active),
  };
}

export function isDraftComplete(draft: ProviderDraft): boolean {
  return Boolean(
    draft.issuer_url.trim() &&
    draft.client_id.trim() &&
    draft.redirect_uris.some((uri) => uri.trim()),
  );
}
