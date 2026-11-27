import {
  Banner,
  Button,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { useAuth } from "./AuthContext";

/** Shown instead of the app while a backend needs a sign-in */
export function SignInPage() {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation();
  const { sessions, signedOut, signIn, isRedirecting, error } = useAuth();
  const location = useLocation();

  const isExpired = signedOut.some((backend) => {
    const session = sessions?.[backend];
    return session?.state === "signed-out" && session.isExpired;
  });
  const isPartial = signedOut.length > 0 && signedOut.length < 3;

  return (
    <Stack as="main" fill="both" align="center" justify="center" padding={6}>
      <Stack gap={4} maxWidth="md" align="center">
        <Text variant="title" as="h1" align="center">
          {t("signIn.title")}
        </Text>
        <Text tone="muted" align="center">
          {isExpired ? t("signIn.expired") : t("signIn.text")}
        </Text>
        {isPartial ? (
          <Text variant="small" tone="muted" align="center">
            {t("signIn.partial", {
              backends: signedOut
                .map((backend) => tCommon(`backends.${backend}`))
                .join(", "),
            })}
          </Text>
        ) : null}
        {error ? (
          <Banner
            text={
              "code" in error && typeof error.code === "string"
                ? t(`errors.${error.code as "noProvider"}`)
                : error.message
            }
          />
        ) : null}
        <Button
          variant="primary"
          size="lg"
          text={t("signIn.action")}
          isLoading={isRedirecting}
          onClick={() => void signIn(location.pathname + location.search)}
        />
      </Stack>
    </Stack>
  );
}
