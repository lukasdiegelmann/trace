/**
 * Mounted once in the app shell: looks for a new version of Trace at
 * `updateCheckInterval`, and tells an admin once that the servers' own
 * update checks are off (UpdateBanner.svelte).
 */
import { Banner } from "@monocircuit/monolithium/components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type BackendId } from "@/api";
import { useSetting } from "@/features/shared/settings";
import { checkForAppUpdate } from "@/pwa/registerServiceWorker";

import { useAdminBackends } from "../common/admin";
import { useAction } from "../common/useAction";
import { isUpdateCheckDue } from "../lib/updateWatch";

const SEEN_KEY = "trace.updates.offNoticeSeen";
const TICK_MS = 15 * 60 * 1000;

/**
 * Only while Trace is in the background: a new version reloads the page,
 * which must not happen under someone's hands.
 */
function useAppUpdateCheck() {
  const [hours] = useSetting("nt", "updateCheckInterval");
  useEffect(() => {
    let lastCheckedAt = Date.now();
    const look = () => {
      if (document.visibilityState !== "hidden") return;
      if (!isUpdateCheckDue(hours, lastCheckedAt, Date.now())) return;
      lastCheckedAt = Date.now();
      void checkForAppUpdate();
    };
    document.addEventListener("visibilitychange", look);
    const timer = setInterval(look, TICK_MS);
    return () => {
      document.removeEventListener("visibilitychange", look);
      clearInterval(timer);
    };
  }, [hours]);
}

/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
interface UpdateConfig {
  enabled?: boolean;
  answered?: boolean;
  envLocked?: boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */

function wasSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function OffNotice({ backends }: { backends: readonly BackendId[] }) {
  const { t } = useTranslation("settings");
  const [isShown, setIsShown] = useState(false);
  const { run } = useAction();
  const joined = backends.join(",");

  useEffect(() => {
    if (!joined || wasSeen()) return;
    let isStale = false;
    const [first] = joined.split(",") as [BackendId, ...BackendId[]];
    api[first]
      .get<UpdateConfig>("/updates/config")
      .then((config) => {
        // Only once the question was answered, so never during the setup.
        if (isStale || !config.answered) return;
        setIsShown(!config.enabled && !config.envLocked);
      })
      .catch(() => {
        // No answer, no notice.
      });
    return () => {
      isStale = true;
    };
  }, [joined]);

  const dismiss = () => {
    setIsShown(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Blocked storage: it shows again after a reload.
    }
  };

  if (!isShown) return null;
  return (
    <Banner
      className="print:hidden"
      text={t("updates.offNotice")}
      actionText={t("updates.turnOn")}
      dismissText={t("actions.close")}
      onDismiss={dismiss}
      onAction={() => {
        dismiss();
        void run(async () => {
          await Promise.all(
            backends.map((backend) =>
              api[backend].put("/updates/config", { enabled: true }),
            ),
          );
        });
      }}
    />
  );
}

export function UpdateWatch() {
  useAppUpdateCheck();
  const admin = useAdminBackends();
  return <OffNotice backends={admin} />;
}
