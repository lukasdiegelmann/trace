import { Row, SegmentedControl } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { BACKEND_IDS, type BackendId } from "@/api";

export function AppSwitch({
  value,
  onChange,
  allowed = BACKEND_IDS,
}: {
  value: BackendId;
  onChange: (backend: BackendId) => void;
  allowed?: readonly BackendId[];
}) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  return (
    <Row>
      <SegmentedControl<BackendId>
        aria-label={t("appSwitch")}
        options={allowed.map((id) => ({
          value: id,
          label: tCommon(`backends.${id}`),
        }))}
        value={value}
        onChange={onChange}
      />
    </Row>
  );
}
