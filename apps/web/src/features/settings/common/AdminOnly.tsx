import { EmptyState } from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { BackendId } from "@/api";

import { useAdminBackends } from "./admin";
import { AppSwitch } from "./AppSwitch";
import { useAppParam } from "./useAppParam";

/**
 * A server-wide admin screen: one app at a time, only those where the user
 * is an admin.
 */
export function AdminPerApp({
  children,
}: {
  children: (backend: BackendId) => ReactNode;
}) {
  const { t } = useTranslation("settings");
  const admin = useAdminBackends();
  const [backend, setBackend] = useAppParam(admin);
  if (admin.length === 0) return <EmptyState text={t("adminOnly")} />;
  return (
    <>
      <AppSwitch value={backend} onChange={setBackend} allowed={admin} />
      {/* A fresh tree per app: no list, draft or secret carries over */}
      <div key={backend} className="contents">
        {children(backend)}
      </div>
    </>
  );
}
