import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

/** A cook's rating; nothing without one. TODO(monolithium): a star rating */
export function Stars({ rating }: { rating: number | null }) {
  const { t } = useTranslation("cooking");
  if (!rating || rating <= 0) return null;
  return (
    <span
      role="img"
      aria-label={t("diary.stars", { rating })}
      className="flex gap-0.5 text-accent"
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden
          size={13}
          fill={rating >= step ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
