import { Spinner } from "@monocircuit/monolithium/components";

import { orderBodyStats } from "../../lib/insights/bodyStats";
import { toggleValue } from "../../lib/insights/order";
import { InsightsHeader } from "../components/InsightsHeader";
import { OrderList } from "../components/OrderList";
import { SectionCard } from "../components/Panel";
import { metricLabel } from "../statistics/labels";
import { useInsightsT } from "../useInsightsT";
import { useNtSettings } from "../useNtSettings";

/** routes/settings/BodyStats.svelte */
export function BodyStatsSettingsPage() {
  const { t } = useInsightsT();
  const settings = useNtSettings();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <InsightsHeader
        title={t("bodyStatsSettings.title")}
        backPath="/nutrition/statistics/settings"
      />
      {!settings.isReady ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("common.loading")} />
        </div>
      ) : (
        <SectionCard hint={t("bodyStatsSettings.hint")}>
          <OrderList
            items={orderBodyStats(settings.bodyStatsOrder).map((key) => ({
              key,
              label: metricLabel(key, t),
              isVisible: !settings.hiddenBodyStats.includes(key),
            }))}
            onOrderChange={(keys) => {
              settings.set("bodyStatsOrder", keys);
            }}
            onVisibilityChange={(key) => {
              settings.set(
                "hiddenBodyStats",
                toggleValue(settings.hiddenBodyStats, key),
              );
            }}
          />
        </SectionCard>
      )}
    </div>
  );
}
