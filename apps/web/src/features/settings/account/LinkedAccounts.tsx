/** The sign-ins linked to each app's account (Profile.svelte) */
import {
  Avatar,
  Button,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { api, BACKEND_IDS, type BackendId } from "@/api";
import { browserSsoDeps, loginUrl, SSO_STORAGE_KEY } from "@/auth/sso";

import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { backendAssetUrl } from "../lib/assets";
import { formatDateTime } from "../lib/format";

interface Link {
  id: number;
  oidc_provider_id: number;
  display_name?: string | null;
  last_login_at?: string | null;
}

interface Provider {
  id: number;
  display_name?: string | null;
  logo_url?: string | null;
}

function Logo({
  backend,
  name,
  url,
}: {
  backend: BackendId;
  name: string;
  url: string | null | undefined;
}) {
  return (
    <Avatar
      name={name}
      src={url ? backendAssetUrl(backend, url) : null}
      size={24}
    />
  );
}

/** The SSO chain brings the browser back to the profile after linking */
function startLink(backend: BackendId, providerId: number): void {
  const deps = browserSsoDeps();
  deps.storage.setItem(
    SSO_STORAGE_KEY,
    JSON.stringify({ current: backend, todo: [], next: "/settings/profile" }),
  );
  deps.navigate(`${loginUrl(backend, providerId)}&link=1`);
}

function AppLinks({ backend }: { backend: BackendId }) {
  const { t, i18n } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const data = useLoad(async () => {
    const [links, providers] = await Promise.all([
      api[backend].get<{ links: Link[] }>("/auth/oidc/links"),
      api[backend].get<{ providers: Provider[] }>("/auth/oidc/providers"),
    ]);
    return { links: links.links, providers: providers.providers };
  }, [backend]);
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();
  if (!data.data) return null;
  const { links, providers } = data.data;
  const unlinked = providers.filter(
    (p) => !links.some((link) => link.oidc_provider_id === p.id),
  );
  if (links.length === 0 && unlinked.length === 0) return null;
  const app = tCommon(`backends.${backend}`);

  return (
    <Stack gap={2}>
      <Text variant="label">{app}</Text>
      {links.map((link) => {
        const name = link.display_name ?? t("profile.provider");
        const logo = providers.find(
          (p) => p.id === link.oidc_provider_id,
        )?.logo_url;
        return (
          <Row key={link.id} gap={2} align="center">
            <Logo backend={backend} name={name} url={logo} />
            <div className="min-w-0 flex-1">
              <KeyValue
                label={name}
                hint={
                  link.last_login_at
                    ? t("profile.lastSignIn", {
                        when: formatDateTime(link.last_login_at, i18n.language),
                      })
                    : undefined
                }
                value={
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("profile.unlink")}
                    aria-label={`${t("profile.unlink")}: ${name}, ${app}`}
                    onClick={() =>
                      void confirm({
                        title: t("profile.unlinkTitle", { name }),
                        message: t("profile.unlinkText", { app }),
                        confirmText: t("profile.unlink"),
                        isDangerous: true,
                      }).then((isConfirmed) => {
                        if (!isConfirmed) return;
                        void run(async () => {
                          await api[backend].post(
                            `/auth/oidc/unlink/${link.id}`,
                            {},
                          );
                          await data.reload();
                        });
                      })
                    }
                  />
                }
              />
            </div>
          </Row>
        );
      })}
      {unlinked.map((provider) => (
        <Row key={provider.id} gap={2} align="center">
          <Logo
            backend={backend}
            name={provider.display_name ?? t("profile.provider")}
            url={provider.logo_url}
          />
          <Button
            variant="secondary"
            size="sm"
            text={t("profile.link", {
              name: provider.display_name ?? t("profile.provider"),
            })}
            onClick={() => {
              startLink(backend, provider.id);
            }}
          />
        </Row>
      ))}
      {dialog}
    </Stack>
  );
}

export function LinkedAccounts() {
  const { t } = useTranslation("settings");
  return (
    <Stack as="section" gap={3}>
      <Text variant="heading" as="h2">
        {t("profile.linked")}
      </Text>
      {BACKEND_IDS.map((backend) => (
        <AppLinks key={backend} backend={backend} />
      ))}
    </Stack>
  );
}
