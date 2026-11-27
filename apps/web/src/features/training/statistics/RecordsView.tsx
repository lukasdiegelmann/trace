import {
  Panel,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronRight, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { formatDay } from "../common/format";
import {
  groupRecords,
  recentRecords,
  recordDay,
  recordValue,
  type StatRecord,
} from "../lib/statistics";
import { categoryName } from "./categoryName";
import type { ViewProps } from "./viewProps";

/** All-time records: the newest ones, then all by category */
export function RecordsView({ data, exercises }: ViewProps) {
  const { t } = useTranslation("training");
  const records = data.records;
  if (!records) return null;
  if (records.length === 0) {
    return (
      <EmptyNote
        icon={<Trophy aria-hidden />}
        text={t("statistics.records.empty")}
      />
    );
  }
  return (
    <Stack gap={3}>
      <Panel title={t("statistics.records.recent")}>
        <RecordList records={recentRecords(records)} />
      </Panel>
      {groupRecords(records, exercises).map((group) => (
        <Panel key={group.category} title={categoryName(t, group.category)}>
          <RecordList records={group.records} hasEstimate />
        </Panel>
      ))}
    </Stack>
  );
}

function RecordList({
  records,
  hasEstimate = false,
}: {
  records: StatRecord[];
  hasEstimate?: boolean;
}) {
  const { t, i18n } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");
  const navigate = useNavigate();
  return (
    <ul className="flex flex-col gap-1">
      {records.map((record) => {
        const { exerciseId } = record;
        const day = recordDay(record);
        const content = (
          <Row gap={2} justify="between" align="center" className="w-full">
            <Stack gap={0} className="min-w-0">
              <Text isTruncated>{record.name}</Text>
              <Text variant="caption" tone="muted">
                {[
                  recordValue(record, unit),
                  day ? formatDay(day, i18n.language) : "",
                  hasEstimate && (record.e1rm ?? 0) > (record.maxWeight ?? 0)
                    ? t("statistics.records.estimate", {
                        value: `${record.e1rm ?? 0} ${unit}`,
                      })
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Stack>
            {typeof exerciseId === "number" && (
              <ChevronRight aria-hidden size={16} className="shrink-0" />
            )}
          </Row>
        );
        return (
          <li key={`${exerciseId}`}>
            {typeof exerciseId === "number" ? (
              <Pressable
                className="flex w-full rounded-control p-2 text-left"
                label={record.name}
                onPress={() =>
                  void navigate(`/training/exercises/${exerciseId}`)
                }
              >
                {content}
              </Pressable>
            ) : (
              <div className="p-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
