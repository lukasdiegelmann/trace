import { EmptyState, Stack } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Stack padding={6}>
      <EmptyState
        text={t("notFound.text")}
        action={{
          text: t("notFound.action"),
          onClick: () => void navigate("/"),
        }}
      />
    </Stack>
  );
}
