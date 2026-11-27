import { Spinner, Stack } from "@monocircuit/monolithium/components";
import { CircleAlert, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyNote } from "./EmptyNote";

/** The spinner of a screen that has nothing to show yet */
export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation("training");
  return (
    <Stack align="center" padding={8}>
      <Spinner size="lg" label={label ?? t("common.loading")} />
    </Stack>
  );
}

export interface LoadFailedProps {
  error: Error;
  onRetry: () => void;
}

export function LoadFailed({ error, onRetry }: LoadFailedProps) {
  const { t } = useTranslation("training");
  return (
    <div role="alert">
      <EmptyNote
        icon={<CircleAlert aria-hidden />}
        text={t("common.loadFailed", { message: error.message })}
        action={{
          text: t("common.retry"),
          icon: <RotateCw aria-hidden size={16} />,
          onClick: onRetry,
        }}
      />
    </div>
  );
}
