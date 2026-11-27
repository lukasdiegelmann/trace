import {
  Button,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

export function LoadingState() {
  const { t } = useTranslation("cooking");
  return (
    <Stack align="center" padding={8}>
      <Spinner size="lg" label={t("cookingCommon.loading")} />
    </Stack>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Stack align="center" gap={3} padding={8}>
      <Text tone="danger" role="alert">
        {message}
      </Text>
      <Button
        variant="secondary"
        size="md"
        text={t("cookingCommon.retry")}
        onClick={onRetry}
      />
    </Stack>
  );
}
