import {
  Banner,
  Box,
  Button,
  ExternalLink,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { integrationsApi, mealsApi } from "../api";
import { useConfirm } from "../components/confirm";
import { useNotify } from "../components/useNotify";
import { cooktraceConfig } from "../foods/sourceConfig";
import { applyCooktraceRefresh, type MealFormState } from "../lib/mealForm";
import {
  checkCooktraceUpdate,
  isCooktraceConfigured,
} from "../lib/sources/cooktrace";
import { useNtSettings } from "../settings";
import { useResource } from "../useResource";

/**
 * Where an imported meal came from, its import notes, and for CookTrace
 * whether the original changed or is gone.
 */
export function SourceCard({
  form,
  onChange,
  onRemoved,
}: {
  form: MealFormState;
  onChange: (next: (form: MealFormState) => MealFormState) => void;
  /** The recipe was deleted here too */
  onRemoved: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const confirm = useConfirm();
  const notify = useNotify();
  const [isDismissed, setIsDismissed] = useState(false);
  const config = cooktraceConfig(settings);
  const canCheck =
    form.sourceApp === "cooktrace" &&
    form.id !== null &&
    form.updatedAt !== null &&
    settings.cooktraceEnabled &&
    isCooktraceConfigured(config);

  const update = useResource(
    canCheck ? `cooktrace-${form.id}-${form.sourceExternalId}` : null,
    () =>
      checkCooktraceUpdate(integrationsApi.cooktrace, config, {
        id: form.id,
        updated_at: form.updatedAt,
        source_app: form.sourceApp,
        source_external_id: form.sourceExternalId,
      }),
  );

  if (!form.sourceApp) return null;
  const app = form.sourceApp === "cooktrace" ? "CookTrace" : form.sourceApp;

  const unlink = async () => {
    if (!(await confirm({ title: t("mealEditor.cooktrace.unlinkTitle") }))) {
      return;
    }
    // The server keeps the source fields of a saved meal (upstream)
    onChange((current) => ({
      ...current,
      sourceApp: null,
      sourceExternalId: null,
      sourceUrl: null,
    }));
  };
  const remove = async () => {
    const isConfirmed = await confirm({
      title: t("mealEditor.cooktrace.deleteTitle"),
      confirmText: t("common.delete"),
      isDangerous: true,
    });
    if (!isConfirmed || form.id === null) return;
    try {
      await mealsApi.remove(form.id);
      notify.success(t("mealEditor.cooktrace.removed"));
      onRemoved();
    } catch (caught) {
      notify.failure(caught);
    }
  };

  return (
    <Box surface="surface" border="all" radius="lg" padding={3}>
      <Stack gap={2}>
        <Row gap={2} align="center" justify="between" shouldWrap>
          <Text variant="label">{t("mealEditor.source.from", { app })}</Text>
          {form.sourceUrl && (
            <ExternalLink
              href={form.sourceUrl}
              text={t("mealEditor.source.open")}
            />
          )}
        </Row>
        {form.importWarnings.length > 0 && (
          <Stack gap={0}>
            <Text variant="caption">{t("mealEditor.source.warnings")}</Text>
            {form.importWarnings.map((warning) => (
              <Text key={warning} variant="small" tone="warning">
                {warning}
              </Text>
            ))}
          </Stack>
        )}
        {update.data?.status === "updated" && !isDismissed && (
          <Banner
            text={t("mealEditor.cooktrace.newer")}
            actionText={t("mealEditor.cooktrace.refresh")}
            onAction={() => {
              const result = update.data;
              if (result?.status !== "updated") return;
              try {
                onChange((current) =>
                  applyCooktraceRefresh(current, result.recipe),
                );
                setIsDismissed(true);
                notify.success(t("mealEditor.cooktrace.refreshed"));
              } catch (caught) {
                notify.error(
                  t("mealEditor.cooktrace.failed", {
                    message:
                      caught instanceof Error ? caught.message : String(caught),
                  }),
                );
              }
            }}
            onDismiss={() => {
              setIsDismissed(true);
            }}
            dismissText={t("common.close")}
          />
        )}
        {update.data?.status === "deleted" && (
          <Stack gap={2}>
            <Banner text={t("mealEditor.cooktrace.deleted")} />
            <Row gap={2}>
              <Button
                size="sm"
                variant="secondary"
                text={t("mealEditor.cooktrace.unlink")}
                onClick={() => void unlink()}
              />
              <Button
                size="sm"
                variant="danger"
                text={t("mealEditor.cooktrace.delete")}
                onClick={() => void remove()}
              />
            </Row>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
