import {
  Banner,
  ExternalLink,
  KeyValue,
  Spinner,
  Text,
} from "@monocircuit/monolithium/components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { reloadToLatestVersion } from "@/pwa/registerServiceWorker";

import { Section } from "../common/SettingsScreen";
import { formatDateTime, relativeTime } from "../lib/format";
import {
  fetchVersionInfo,
  isBundleOutdated,
  shortCommit,
  type VersionInfo,
} from "../lib/versionInfo";

export interface DeployInfoSectionProps {
  /** The commit this bundle was built from, "" if unknown */
  buildCommit?: string;
  load?: () => Promise<VersionInfo | null>;
  reload?: () => Promise<void>;
}

/** Where the running deploy comes from and when it was made */
export function DeployInfoSection({
  buildCommit = __TRACE_BUILD_COMMIT__,
  load = fetchVersionInfo,
  reload = reloadToLatestVersion,
}: DeployInfoSectionProps) {
  const { t, i18n } = useTranslation("settings");
  // undefined while it loads
  const [info, setInfo] = useState<VersionInfo | null>();

  useEffect(() => {
    let isCurrent = true;
    void load().then((loaded) => {
      if (isCurrent) setInfo(loaded);
    });
    return () => {
      isCurrent = false;
    };
  }, [load]);

  const dateTime = (value: string) => formatDateTime(value, i18n.language);

  return (
    <Section title={t("deploy.title")}>
      {isBundleOutdated(buildCommit, info ?? null) ? (
        <Banner
          text={t("deploy.updateAvailable")}
          actionText={t("deploy.reload")}
          onAction={() => void reload()}
        />
      ) : null}
      <KeyValue label={t("deploy.version")} value={__TRACE_VERSION__} />
      {info === undefined ? (
        <Spinner label={t("loading")} />
      ) : info === null ? (
        <Text variant="small" tone="muted">
          {t("deploy.none")}
        </Text>
      ) : (
        <>
          <KeyValue
            label={t("deploy.commit")}
            value={
              info.commitUrl ? (
                <ExternalLink
                  href={info.commitUrl}
                  text={shortCommit(info.commit)}
                />
              ) : (
                shortCommit(info.commit)
              )
            }
          />
          {info.ref ? (
            <KeyValue label={t("deploy.branch")} value={info.ref} />
          ) : null}
          {info.deployedAt ? (
            <KeyValue
              label={t("deploy.deployedAt")}
              value={dateTime(info.deployedAt)}
              hint={relativeTime(info.deployedAt, i18n.language)}
            />
          ) : null}
          {info.builtAt ? (
            <KeyValue
              label={t("deploy.builtAt")}
              value={dateTime(info.builtAt)}
            />
          ) : null}
          {info.source ? (
            <KeyValue
              label={t("deploy.source")}
              value={
                info.source === "manual" ? (
                  t("deploy.manual")
                ) : info.runUrl ? (
                  <ExternalLink href={info.runUrl} text={t("deploy.ciRun")} />
                ) : (
                  t("deploy.ci")
                )
              }
            />
          ) : null}
          {info.repoUrl ? (
            <ExternalLink href={info.repoUrl} text={t("deploy.repository")} />
          ) : null}
        </>
      )}
    </Section>
  );
}
