import {
  Chip,
  ExternalLink,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { Section, SettingsScreen } from "../common/SettingsScreen";
import { APP_VERSIONS } from "../lib/versions";
import { DeployInfoSection } from "./DeployInfoSection";

const APPS = [
  { id: "nutritrace", name: "NutriTrace", backend: "nt" },
  { id: "cooktrace", name: "CookTrace", backend: "ct" },
  { id: "lifttrace", name: "LiftTrace", backend: "lt" },
] as const;

const FEATURES = ["areas", "selfHosted", "pwa", "privacy"] as const;

export function AboutPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.about.title")}
      description={t("about.description")}
    >
      <Section title="Trace">
        <Row gap={3} align="center">
          <img
            src="/icons/pwa-192x192.png"
            alt=""
            width={48}
            height={48}
            className="rounded-container"
          />
          <Row gap={2} shouldWrap>
            <Chip text="PWA" />
          </Row>
        </Row>
        <Text>{t("about.what")}</Text>
        <Stack as="ul" gap={1}>
          {FEATURES.map((feature) => (
            <li key={feature}>
              <Text variant="small">{t(`about.features.${feature}`)}</Text>
            </li>
          ))}
        </Stack>
        <Text variant="small">{t("about.federation")}</Text>
        <Text variant="small" tone="muted">
          {t("about.license")}
        </Text>
        <ExternalLink
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          text="GNU AGPL 3.0"
        />
      </Section>
      <DeployInfoSection />
      <Section title={t("about.builtOn")} hint={t("about.builtOnHint")}>
        {APPS.map((app) => (
          <Stack key={app.id} gap={1}>
            <KeyValue label={app.name} value={APP_VERSIONS[app.backend]} />
            <ExternalLink
              href={`https://github.com/TraceApps/${app.id}`}
              text={t("about.source", { app: app.name })}
            />
            <ExternalLink
              href={`https://github.com/TraceApps/${app.id}/issues/new/choose`}
              text={t("about.reportBug", { app: app.name })}
            />
            <ExternalLink
              href={`https://hosted.weblate.org/engage/${app.id}/`}
              text={t("about.translate", { app: app.name })}
            />
          </Stack>
        ))}
        <ExternalLink
          href="https://traceapps.github.io/docs/"
          text={t("about.docs")}
        />
        <ExternalLink
          href="https://world.openfoodfacts.org"
          text={t("about.offData")}
        />
      </Section>
      <Section title={t("about.support")} hint={t("about.supportHint")}>
        <ExternalLink href="https://ko-fi.com/traceapps" text="Ko-fi" />
        <ExternalLink
          href="https://github.com/sponsors/TraceApps?metadata_app=trace&metadata_from=app"
          text="GitHub Sponsors"
        />
      </Section>
      <Section title={t("about.disclaimers")}>
        <Text variant="small" tone="muted">
          {t("about.medical")}
        </Text>
        <Text variant="small" tone="muted">
          {t("about.training")}
        </Text>
        <Text variant="small" tone="muted">
          {t("about.ai")}
        </Text>
      </Section>
    </SettingsScreen>
  );
}
