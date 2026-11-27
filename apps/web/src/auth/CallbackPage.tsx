import {
  Button,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";

import { isBackendId, type BackendId } from "@/api";

import { useAuth } from "./AuthContext";
import { browserSsoDeps, continueSignIn, SsoError, type SsoDeps } from "./sso";

interface Failure {
  backend: BackendId | null;
  error: SsoError;
}

export interface CallbackPageProps {
  /** For tests */
  deps?: SsoDeps;
}

/** `/auth/callback/:backend`: where each backend's OIDC callback lands */
export function CallbackPage({ deps }: CallbackPageProps) {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation();
  const { backend } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [outcomeFailure, setFailure] = useState<Failure | null>(null);
  const hasRun = useRef(false);
  const failure: Failure | null = isBackendId(backend)
    ? outcomeFailure
    : {
        backend: null,
        error: new SsoError("missingResult", "unknown backend"),
      };

  useEffect(() => {
    // Strict mode runs effects twice; the chain must advance once.
    if (hasRun.current || !isBackendId(backend)) return;
    hasRun.current = true;
    void continueSignIn(backend, search, deps ?? browserSsoDeps()).then(
      async (outcome) => {
        if (outcome.kind === "error") {
          setFailure({ backend: outcome.backend, error: outcome.error });
        } else if (outcome.kind === "done") {
          await refresh();
          void navigate(outcome.next, { replace: true });
        }
        // "redirect": the browser is already on its way to the next backend.
      },
    );
  }, [backend, search, deps, navigate, refresh]);

  if (!failure) {
    return (
      <Stack fill="both" align="center" justify="center" gap={3} padding={6}>
        <Spinner size="lg" label={t("callback.working")} />
        <Text tone="muted">{t("callback.working")}</Text>
      </Stack>
    );
  }

  const { error } = failure;
  const message = error.code
    ? t(`errors.${error.code}`)
    : error.message === "callback_failed"
      ? t("errors.callback_failed")
      : error.message;

  return (
    <Stack fill="both" align="center" justify="center" gap={4} padding={6}>
      <Stack gap={3} maxWidth="md" align="center">
        <Text variant="heading" as="h1" tone="danger" align="center">
          {t("callback.failed", {
            backend: failure.backend
              ? tCommon(`backends.${failure.backend}`)
              : "Trace",
            message,
          })}
        </Text>
        <Button
          variant="primary"
          size="md"
          text={t("callback.retry")}
          onClick={() => void navigate("/", { replace: true })}
        />
      </Stack>
    </Stack>
  );
}
