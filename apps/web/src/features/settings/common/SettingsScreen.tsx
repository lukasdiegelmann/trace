import {
  Banner,
  Button,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { BackendId } from "@/api";

import { useSettingsState } from "./binding";
import { useSearchTarget } from "./useSearchTarget";

export interface SettingsScreenProps {
  title: string;
  description?: string;
  /** The backends whose settings this screen edits: load and save errors */
  backends?: readonly BackendId[];
  children: ReactNode;
}

/** The frame of one /settings/* screen: back, title, save errors, content */
export function SettingsScreen({
  title,
  description,
  backends = [],
  children,
}: SettingsScreenProps) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const navigate = useNavigate();
  const { failed, error, reload } = useSettingsState(backends);
  const frame = useSearchTarget();

  return (
    <Stack ref={frame} gap={6} padding={6} maxWidth="lg">
      <Stack gap={2}>
        <Row>
          <Button
            variant="ghost"
            size="sm"
            text={t("actions.back")}
            onClick={() => void navigate("/settings")}
          >
            <ArrowLeft aria-hidden />
          </Button>
        </Row>
        <Text variant="title" as="h1">
          {title}
        </Text>
        {description ? <Text tone="muted">{description}</Text> : null}
      </Stack>
      {error ? (
        <Banner
          text={t("errors.settings", {
            backends: failed.map((id) => tCommon(`backends.${id}`)).join(", "),
            message: error.message,
          })}
          actionText={t("actions.retry")}
          onAction={reload}
        />
      ) : null}
      {children}
    </Stack>
  );
}

export interface SectionProps {
  title?: string;
  hint?: string;
  children: ReactNode;
}

export function Section({ title, hint, children }: SectionProps) {
  return (
    <Stack as="section" gap={3} aria-label={title}>
      {title ? (
        <Text variant="heading" as="h2">
          {title}
        </Text>
      ) : null}
      {hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
}

export interface LoadStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  /** Shown once there is data; stays while a reload runs */
  hasData: boolean;
  children: ReactNode;
}

export function LoadState({
  isLoading,
  error,
  onRetry,
  hasData,
  children,
}: LoadStateProps) {
  const { t } = useTranslation("settings");
  return (
    <>
      {error ? (
        <Banner
          text={error.message}
          actionText={onRetry ? t("actions.retry") : undefined}
          onAction={onRetry}
        />
      ) : null}
      {hasData ? children : isLoading ? <Spinner label={t("loading")} /> : null}
    </>
  );
}
