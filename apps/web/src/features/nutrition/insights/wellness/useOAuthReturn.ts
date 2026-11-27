import { useToast } from "@monocircuit/monolithium/components";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { oauthResult, OAUTH_PARAMS } from "../../lib/insights/oauth";
import { useInsightsT } from "../useInsightsT";

/** Says how a provider's OAuth round trip went, then cleans the URL */
export function useOAuthReturn(): void {
  const { t } = useInsightsT();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasReported = useRef(false);

  useEffect(() => {
    const result = oauthResult(searchParams);
    if (!result || hasReported.current) return;
    hasReported.current = true;
    if (result.isConnected) {
      toast.info(
        t("wellness.oauth.connected", { provider: result.providerName }),
      );
    } else {
      toast.error(
        t("wellness.oauth.failed", {
          provider: result.providerName,
          message: result.message ?? t("wellness.oauth.unknownError"),
        }),
      );
    }
    const next = new URLSearchParams(searchParams);
    for (const param of [...OAUTH_PARAMS, "msg"]) next.delete(param);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);
}
