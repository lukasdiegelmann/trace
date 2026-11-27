import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export type Translate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * `t` for the `insights` part of the nutrition namespace. Keys are built
 * from metric ids, so they are plain strings; `locales.test.ts` checks
 * that every id has its strings.
 */
export function useInsightsT(): { t: Translate; locale: string } {
  const { t, i18n } = useTranslation("nutrition");
  const translate = useCallback<Translate>(
    (key, options) => (t as unknown as Translate)(`insights.${key}`, options),
    [t],
  );
  return { t: translate, locale: i18n.language };
}
