import { useTranslation } from "react-i18next";

import { AdminPerApp } from "../common/AdminOnly";
import { SettingsScreen } from "../common/SettingsScreen";
import { EmailForm } from "./EmailForm";

export function EmailPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.email.title")}
      description={t("email.description")}
    >
      <AdminPerApp>{(backend) => <EmailForm backend={backend} />}</AdminPerApp>
    </SettingsScreen>
  );
}
