import {
  Button,
  Row,
  SegmentedControl,
  Text,
} from "@monocircuit/monolithium/components";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useNavigate } from "react-router";

import { useInsightsT } from "../useInsightsT";

export interface InsightsHeaderProps {
  title: string;
  /** Which of the two screens this is; shows the switch between them */
  section?: "statistics" | "wellness";
  /** Where the settings button leads */
  settingsPath?: string;
  /** A back button instead of the switch, for the settings screens */
  backPath?: string;
}

export function InsightsHeader({
  title,
  section,
  settingsPath,
  backPath,
}: InsightsHeaderProps) {
  const { t } = useInsightsT();
  const navigate = useNavigate();
  return (
    <Row gap={3} align="center" justify="between" shouldWrap>
      <Row gap={2} align="center">
        {backPath ? (
          <Button
            size="sm"
            aria-label={t("common.back")}
            onClick={() => void navigate(backPath)}
          >
            <ArrowLeft aria-hidden size={18} />
          </Button>
        ) : null}
        <Text variant="title" as="h1">
          {title}
        </Text>
      </Row>
      <Row gap={2} align="center">
        {section ? (
          <SegmentedControl
            aria-label={t("common.sectionSwitch")}
            variant="pill"
            value={section}
            onChange={(next) => void navigate(`/nutrition/${next}`)}
            options={[
              { value: "statistics", label: t("statistics.title") },
              { value: "wellness", label: t("wellness.title") },
            ]}
          />
        ) : null}
        {settingsPath ? (
          <Button
            size="sm"
            variant="secondary"
            aria-label={t("common.settings")}
            onClick={() => void navigate(settingsPath)}
          >
            <Settings2 aria-hidden size={18} />
          </Button>
        ) : null}
      </Row>
    </Row>
  );
}
