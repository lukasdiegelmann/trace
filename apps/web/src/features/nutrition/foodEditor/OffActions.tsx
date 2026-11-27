import {
  Banner,
  Button,
  Row,
  Stack,
} from "@monocircuit/monolithium/components";
import { ExternalLink, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { appConfigApi, proxyGet } from "../api";
import { useNotify } from "../components/useNotify";
import {
  applyOffRefresh,
  offValuesOf,
  type FoodFormState,
} from "../lib/foodForm";
import {
  buildOffContributionUrl,
  isOffUploadAccepted,
  offProductPageUrl,
} from "../lib/sources/offContribute";
import { lookupBarcode } from "../lib/sources/openFoodFacts";
import { offNotice, type OffNotice } from "../lib/sources/offStatus";
import type { OffInfo } from "../lib/sources/types";
import { offOptions } from "../foods/sourceConfig";
import { useNtSettings } from "../settings";
import { useResource } from "../useResource";

/** The "as prepared", "implausible" or "no values" notice under the barcode */
export function OffNoticeBanner({
  notice,
  onUsePrepared,
}: {
  notice: OffNotice;
  onUsePrepared: (info: OffInfo) => void;
}) {
  const { t } = useTranslation("nutrition");
  if (notice.status === "preparedOnly" && notice.kcal !== null) {
    return (
      <Banner
        text={t("foodEditor.off.preparedOnly", {
          kcal: notice.kcal,
          unit: notice.unit,
        })}
        actionText={t("foodEditor.off.usePrepared")}
        onAction={() => {
          onUsePrepared(notice.info);
        }}
      />
    );
  }
  return (
    <Banner
      text={t(
        notice.status === "implausible"
          ? "foodEditor.off.implausible"
          : "foodEditor.off.none",
      )}
    />
  );
}

/**
 * Refresh a food from Open Food Facts, or share it there (with the user's
 * own account) and view it.
 */
export function OffActions({
  form,
  onChange,
  onNotice,
}: {
  form: FoodFormState;
  onChange: (next: (form: FoodFormState) => FoodFormState) => void;
  onNotice: (notice: OffNotice | null) => void;
}) {
  const { t, i18n } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const notify = useNotify();
  const barcode = form.barcode.trim();
  const [checked, setChecked] = useState(barcode);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Whether OFF knows the code, asked once the typing pauses
  useEffect(() => {
    const timer = setTimeout(() => {
      setChecked(barcode);
    }, 600);
    return () => {
      clearTimeout(timer);
    };
  }, [barcode]);
  const presence = useResource(checked ? `off-${checked}` : null, async () => {
    const isFound = await lookupBarcode(proxyGet, checked, offOptions(settings))
      .then((food) => food !== null)
      .catch(() => false);
    return { isPresent: isFound };
  });
  const isPresent = presence.data?.isPresent ?? false;

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      // Live: past the server's local mirror
      const food = await lookupBarcode(proxyGet, barcode, {
        ...offOptions(settings),
        isLive: true,
      });
      if (!food) {
        notify.info(t("foodEditor.off.notFound"));
        return;
      }
      const result = applyOffRefresh(form, offValuesOf(food));
      onChange(() => result.form);
      if (result.reason === "updated") {
        onNotice(null);
        notify.success(t("foodEditor.off.updated", { count: result.changed }));
      } else if (result.reason === "upToDate") {
        notify.info(t("foodEditor.off.upToDate"));
      } else if (result.reason === "unitsDiffer") {
        notify.info(t("foodEditor.off.unitsDiffer", { unit: food.unit }));
      } else {
        onNotice(offNotice(barcode, food.offInfo));
      }
    } catch (caught) {
      notify.error(
        t("foodEditor.off.failed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const share = async () => {
    if (!settings.offUsername || !settings.offPassword) {
      notify.info(t("foodEditor.off.needsAccount"));
      return;
    }
    setIsUploading(true);
    try {
      const locks = await appConfigApi.envLocks().catch(() => null);
      if (locks?.off_local_only) {
        notify.error(t("foodEditor.off.uploadDisabled"));
        return;
      }
      const url = buildOffContributionUrl(
        {
          name: form.name,
          barcode,
          brand: form.brand,
          portion: form.portion,
          unit: form.unit,
          nutrition: Object.fromEntries(
            Object.entries(form.nutrients).filter(([, text]) => text !== ""),
          ),
        },
        {
          username: settings.offUsername,
          password: settings.offPassword,
          country: settings.offUploadCountry,
        },
        i18n.language,
      );
      if (!url) {
        notify.info(t("editor.nameRequired"));
        return;
      }
      // Straight to Open Food Facts, as the old UI does
      const response = await fetch(url);
      const answer = (await response.json()) as { status_verbose?: string };
      if (!isOffUploadAccepted(answer)) {
        throw new Error(answer.status_verbose ?? String(response.status));
      }
      notify.success(t("foodEditor.off.submitted"));
      setTimeout(() => {
        presence.reload();
      }, 3000);
    } catch (caught) {
      notify.error(
        t("foodEditor.off.uploadFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!barcode || !settings.offEnabled) return null;
  return (
    <Stack gap={1}>
      <Row gap={2} shouldWrap>
        <Button
          size="sm"
          variant="secondary"
          text={t("foodEditor.off.refresh")}
          isLoading={isRefreshing}
          onClick={() => void refresh()}
        >
          <RefreshCw aria-hidden size={14} />
        </Button>
        {isPresent ? (
          <Button
            size="sm"
            variant="secondary"
            text={t("foodEditor.off.view")}
            onClick={() => {
              window.open(
                offProductPageUrl(barcode),
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            <ExternalLink aria-hidden size={14} />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            text={t(
              isUploading ? "foodEditor.off.uploading" : "foodEditor.off.share",
            )}
            isLoading={isUploading}
            onClick={() => void share()}
          >
            <Upload aria-hidden size={14} />
          </Button>
        )}
      </Row>
    </Stack>
  );
}
