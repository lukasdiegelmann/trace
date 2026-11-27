import {
  Button,
  Input,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  Copy,
  ExternalLink as ExternalIcon,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";
import { useState } from "react";

import { suggestedRedirectUri } from "../../lib/insights/oauth";
import { useInsightsT } from "../useInsightsT";
import type { ConfigProvider, Credentials } from "./credentials";

const HELP_LINKS: Record<ConfigProvider, string> = {
  "google-health": "https://developers.google.com/health/setup",
  withings: "https://developer.withings.com/dashboard/",
  garmin: "https://developer.garmin.com/gc-developer-program/health-api/",
};

export interface CredentialsFormProps {
  provider: ConfigProvider;
  initial: Credentials;
  onSave: (credentials: Credentials) => Promise<void>;
  onCancel?: () => void;
}

/** The OAuth app the user registered at the provider */
export function CredentialsForm({
  provider,
  initial,
  onSave,
  onCancel,
}: CredentialsFormProps) {
  const { t } = useInsightsT();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [isSecretShown, setSecretShown] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const suggested = suggestedRedirectUri(window.location.origin, provider);
  const keys = provider === "garmin" ? "consumer" : "client";

  async function copy() {
    try {
      await navigator.clipboard.writeText(form.redirectUri || suggested);
      toast.info(t("wellnessSettings.copied"));
    } catch {
      toast.error(t("wellnessSettings.copyFailed"));
    }
  }

  async function save() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <Stack gap={3}>
      <Text variant="label">{t("wellnessSettings.credentials")}</Text>
      <Text variant="caption">{t(`wellnessSettings.setup.${provider}`)}</Text>
      <Row>
        <Button
          size="sm"
          text={t("wellnessSettings.setupLink")}
          isIconTrailing
          onClick={() =>
            window.open(HELP_LINKS[provider], "_blank", "noopener")
          }
        >
          <ExternalIcon aria-hidden size={14} />
        </Button>
      </Row>
      <Input
        name={`${provider}-client-id`}
        autoComplete="off"
        label={t(`wellnessSettings.${keys}.id`)}
        value={form.id}
        onChange={(event) => {
          setForm({ ...form, id: event.target.value });
        }}
      />
      <Row gap={2} align="center">
        <div className="min-w-0 flex-1">
          <Input
            name={`${provider}-client-secret`}
            type={isSecretShown ? "text" : "password"}
            autoComplete="new-password"
            label={t(`wellnessSettings.${keys}.secret`)}
            value={form.secret}
            onChange={(event) => {
              setForm({ ...form, secret: event.target.value });
            }}
          />
        </div>
        <Button
          size="sm"
          aria-label={t(
            isSecretShown
              ? "wellnessSettings.hideSecret"
              : "wellnessSettings.showSecret",
          )}
          onClick={() => {
            setSecretShown((isShown) => !isShown);
          }}
        >
          {isSecretShown ? (
            <EyeOff aria-hidden size={16} />
          ) : (
            <Eye aria-hidden size={16} />
          )}
        </Button>
      </Row>
      <Row gap={2} align="center">
        <div className="min-w-0 flex-1">
          <Input
            name={`${provider}-redirect-uri`}
            type="url"
            label={t("wellnessSettings.redirectUri")}
            value={form.redirectUri}
            onChange={(event) => {
              setForm({ ...form, redirectUri: event.target.value });
            }}
          />
        </div>
        <Button
          size="sm"
          aria-label={t("wellnessSettings.useSuggested")}
          onClick={() => {
            setForm({ ...form, redirectUri: suggested });
          }}
        >
          <Wand2 aria-hidden size={16} />
        </Button>
        <Button
          size="sm"
          aria-label={t("wellnessSettings.copyUri")}
          onClick={() => void copy()}
        >
          <Copy aria-hidden size={16} />
        </Button>
      </Row>
      <Text variant="caption">
        {t("wellnessSettings.redirectHint", { uri: suggested })}
      </Text>
      <Row gap={2} justify="end">
        {onCancel ? (
          <Button size="sm" text={t("common.cancel")} onClick={onCancel} />
        ) : null}
        <Button
          size="sm"
          variant="primary"
          text={t("common.save")}
          isLoading={isSaving}
          onClick={() => void save()}
        />
      </Row>
    </Stack>
  );
}
