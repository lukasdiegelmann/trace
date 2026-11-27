import {
  Button,
  Meter,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronRight, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { isMissed } from "../lib/goals";
import { round1 } from "../lib/nutrition";
import { useNutritionFormat } from "../useNutritionFormat";

export interface GoalRowProps {
  name: string;
  /** "⚡" or "📈" where the calorie goal comes from the mode */
  marker?: string;
  unit: string;
  current: number | null;
  target: number | null;
  isMin?: boolean;
  /** "as of …" for a body stat that isn't from today */
  asOf?: string | null;
  /** In "All fields": a value without any goal reads differently */
  hasGoal?: boolean;
  /** Only rows of "Your goals" turn red when missed */
  canWarn?: boolean;
  onPress: () => void;
  /** Opens the stat's trend in Statistics, where it has one */
  onShowTrend?: () => void;
  /** In "All fields": this one has a goal */
  isMarked?: boolean;
}

export function GoalRow({
  name,
  marker,
  unit,
  current,
  target,
  isMin,
  asOf,
  hasGoal = true,
  canWarn,
  onPress,
  onShowTrend,
  isMarked,
}: GoalRowProps) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const isBad = Boolean(canWarn) && isMissed(current, target, Boolean(isMin));
  const targetText = `${format.number(target ?? 0, 1)} ${unit}`.trim();
  const progress =
    current === null
      ? targetText
      : `${format.number(round1(current))} / ${targetText}`;
  const detail = [
    progress,
    ...(isMin ? [t("goals.row.min")] : []),
    ...(asOf ? [asOf] : []),
  ].join(" ");

  return (
    <li
      className={
        isMarked
          ? "flex list-none items-center border-l-2 border-accent"
          : "flex list-none items-center"
      }
    >
      <Pressable
        onPress={onPress}
        title={asOf ? t("goals.row.staleTip") : undefined}
        label={t("goals.row.edit", { name })}
        shouldGrow
        paddingY={2}
        paddingX={3}
      >
        <Row gap={3} align="center">
          <Stack gap={1} shouldGrow>
            <Text>{marker ? `${name} ${marker}` : name}</Text>
            {!hasGoal ? (
              <Text variant="caption">{t("goals.row.noGoal")}</Text>
            ) : target === null ? (
              <Text variant="caption">{t("goals.row.notSet")}</Text>
            ) : (
              <>
                <div className="max-w-52">
                  <Meter
                    ariaLabel={`${name}: ${detail}`}
                    size="sm"
                    tone={isBad ? "danger" : "accent"}
                    // Meter turns red past its max: only a missed maximum may
                    value={
                      isBad && !isMin
                        ? (current ?? 0)
                        : Math.min(current ?? 0, target)
                    }
                    max={Math.max(target, 0.0001)}
                  />
                </div>
                <Text variant="caption" tone={isBad ? "danger" : "muted"}>
                  {detail}
                </Text>
              </>
            )}
          </Stack>
          <ChevronRight aria-hidden size={16} />
        </Row>
      </Pressable>
      {onShowTrend && (
        <Button
          size="sm"
          aria-label={t("goals.row.trend", { name })}
          onClick={onShowTrend}
        >
          <TrendingUp aria-hidden size={16} />
        </Button>
      )}
    </li>
  );
}
