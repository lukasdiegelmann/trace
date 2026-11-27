import { Button, Row, Text } from "@monocircuit/monolithium/components";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface StarRatingProps {
  value: number | null;
  /** Without it the stars are only shown */
  onChange?: (next: number) => void;
  size?: number;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * 1 to 5 stars; picking the current one clears the rating (0).
 * TODO(monolithium): StarRating component.
 */
export function StarRating({ value, onChange, size = 20 }: StarRatingProps) {
  const { t } = useTranslation("cooking");
  const rating = value ?? 0;
  const star = (n: number) => (
    <Star
      aria-hidden
      size={size}
      className={n <= rating ? "fill-current text-warning" : "text-muted"}
    />
  );
  if (!onChange) {
    return (
      <Text
        as="span"
        aria-label={t("recipeCommon.rated", { count: rating })}
        role="img"
      >
        <span className="inline-flex gap-0.5">
          {STARS.map((n) => (
            <span key={n}>{star(n)}</span>
          ))}
        </span>
      </Text>
    );
  }
  return (
    <Row gap={0} aria-label={t("recipeCommon.rating")} role="group">
      {STARS.map((n) => (
        <Button
          key={n}
          variant="ghost"
          size="sm"
          aria-label={t("recipeCommon.rate", { count: n })}
          aria-pressed={n === rating}
          onClick={() => {
            onChange(n === rating ? 0 : n);
          }}
        >
          {star(n)}
        </Button>
      ))}
    </Row>
  );
}
