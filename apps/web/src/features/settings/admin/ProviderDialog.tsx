import {
  Button,
  Dialog,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { BackendId } from "@/api";

import { SecretRow, SelectRow, SwitchRow, TextRow } from "../common/fields";
import {
  CUSTOM_PRESET,
  detectPreset,
  OIDC_PRESETS,
  type OidcPreset,
} from "../lib/oidcPresets";
import {
  draftFromPreset,
  isDraftComplete,
  type ProviderDraft,
} from "../lib/oidcDraft";

export function ProviderDialog({
  backend,
  provider,
  isBusy,
  onClose,
  onSave,
}: {
  backend: BackendId;
  /** null: a new provider */
  provider: ProviderDraft | null;
  isBusy: boolean;
  onClose: () => void;
  onSave: (draft: ProviderDraft) => void;
}) {
  const { t } = useTranslation("settings");
  const redirectUri = `${window.location.origin}/${backend}/api/auth/oidc/callback/:providerId`;
  const [presetId, setPresetId] = useState<OidcPreset["id"]>(
    () =>
      (provider
        ? detectPreset(provider.display_name, provider.issuer_url)
        : CUSTOM_PRESET
      ).id,
  );
  const [draft, setDraft] = useState<ProviderDraft>(
    () => provider ?? draftFromPreset(CUSTOM_PRESET, redirectUri),
  );
  const preset =
    OIDC_PRESETS.find((candidate) => candidate.id === presetId) ??
    CUSTOM_PRESET;
  const set = (patch: Partial<ProviderDraft>) => {
    setDraft((old) => ({ ...old, ...patch }));
  };
  const text = (
    key:
      | "display_name"
      | "issuer_url"
      | "client_id"
      | "scope"
      | "admin_group_claim"
      | "admin_group_value"
      | "logo_url",
    placeholder?: string,
  ) => (
    <TextRow
      label={t(`oidc.fields.${key}`)}
      value={draft[key]}
      placeholder={placeholder}
      isLive
      onCommit={(value) => {
        set({ [key]: value });
      }}
    />
  );

  return (
    <Dialog
      open
      size="lg"
      title={t(provider ? "oidc.edit" : "oidc.add")}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      cancelText={t("actions.cancel")}
      confirmText={t("actions.save")}
      isConfirmDisabled={!isDraftComplete(draft)}
      isBusy={isBusy}
      onConfirm={() => {
        onSave(draft);
      }}
    >
      <Stack gap={3}>
        <SelectRow<OidcPreset["id"]>
          label={t("oidc.preset")}
          hint={t(`oidc.presetHelp.${presetId}`)}
          value={presetId}
          options={OIDC_PRESETS.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
          }))}
          onChange={(id) => {
            setPresetId(id);
            const next = OIDC_PRESETS.find((c) => c.id === id);
            // A preset only fills in a new provider's defaults.
            if (next && !provider) {
              set({
                scope: next.scope,
                token_endpoint_auth_method: next.authMethod,
                admin_group_claim: next.adminGroupClaim,
                display_name: next.displayName,
                logo_url: next.logoUrl,
              });
            }
          }}
        />
        {text("display_name")}
        {text("issuer_url", preset.issuerHint)}
        {text("client_id")}
        <SecretRow
          label={t("oidc.fields.client_secret")}
          hint={provider ? t("oidc.keepSecret") : undefined}
          value={draft.client_secret}
          isLive
          onCommit={(client_secret) => {
            set({ client_secret });
          }}
        />
        <Stack gap={2}>
          <Text variant="label">{t("oidc.redirectUris")}</Text>
          {draft.redirect_uris.map((uri, index) => (
            <Row key={index} gap={2} align="end">
              <div className="min-w-0 flex-1">
                <TextRow
                  type="url"
                  label={t("oidc.redirectUri", { number: index + 1 })}
                  value={uri}
                  isLive
                  onCommit={(value) => {
                    set({
                      redirect_uris: draft.redirect_uris.map((old, i) =>
                        i === index ? value : old,
                      ),
                    });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="md"
                aria-label={t("actions.removeNamed", { name: uri })}
                isDisabled={draft.redirect_uris.length <= 1}
                onClick={() => {
                  set({
                    redirect_uris: draft.redirect_uris.filter(
                      (_, i) => i !== index,
                    ),
                  });
                }}
              >
                <X aria-hidden />
              </Button>
            </Row>
          ))}
          <Row>
            <Button
              variant="ghost"
              size="sm"
              text={t("oidc.addUri")}
              onClick={() => {
                set({ redirect_uris: [...draft.redirect_uris, redirectUri] });
              }}
            />
          </Row>
        </Stack>
        {text("scope")}
        <SelectRow<string>
          label={t("oidc.fields.token_endpoint_auth_method")}
          value={draft.token_endpoint_auth_method}
          options={["client_secret_post", "client_secret_basic", "none"].map(
            (value) => ({ value, label: value }),
          )}
          onChange={(token_endpoint_auth_method) => {
            set({ token_endpoint_auth_method });
          }}
        />
        {(
          [
            "auto_link_verified_email",
            "auto_register_new_users",
            "is_active",
          ] as const
        ).map((key) => (
          <SwitchRow
            key={key}
            label={t(`oidc.fields.${key}`)}
            isChecked={draft[key]}
            onChange={(isOn) => {
              set({ [key]: isOn });
            }}
          />
        ))}
        {preset.hasGroups ? (
          <>
            {text("admin_group_claim")}
            {text("admin_group_value")}
          </>
        ) : null}
        {text("logo_url")}
      </Stack>
    </Dialog>
  );
}
