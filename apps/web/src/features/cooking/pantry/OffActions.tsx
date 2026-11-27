import {
  Button,
  ExternalLink,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Download, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/shared/settings";

import { useNotify } from "../common/useNotify";
import {
  offContribute,
  offLookupBarcode,
  type ExternalFood,
} from "../lib/externalFoods";
import { mergeOffProduct, type PantryDraft } from "../lib/pantryForm";

const VERIFY_DELAY_MS = 3000;

type Verification = "none" | "checking" | "confirmed" | "pending";

export interface OffActionsProps {
  draft: PantryDraft;
  /** Applies "Refresh from OFF" to the form */
  onMerge: (merge: (draft: PantryDraft) => PantryDraft) => void;
}

/**
 * "Refresh from OFF" and "Share to OFF" / "View on OFF" for the barcode
 * in the form.
 */
export function OffActions({ draft, onMerge }: OffActionsProps) {
  const { t, i18n } = useTranslation("cooking");
  const notify = useNotify();
  const { values: settings } = useSettings("ct");
  const barcode = draft.barcode.trim();
  const language = settings.offSearchLanguage;
  const country = settings.offSearchCountry;

  const [presence, setPresence] = useState<{
    barcode: string;
    isOnOff: boolean;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [verification, setVerification] = useState<Verification>("none");
  const isOnOff = presence?.barcode === barcode && presence.isOnOff;

  useEffect(() => {
    let isStale = false;
    // Half-typed codes aren't looked up on every key.
    const timer = setTimeout(() => {
      void offLookupBarcode(barcode, { language, country }).then((found) => {
        if (!isStale) setPresence({ barcode, isOnOff: found !== null });
      });
    }, 600);
    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [barcode, language, country]);

  const lookup = (): Promise<ExternalFood | null> =>
    offLookupBarcode(barcode, { language, country });

  const download = async () => {
    setIsDownloading(true);
    try {
      const product = await lookup();
      if (!product) {
        notify.error(t("pantryItem.off.notFound"));
        return;
      }
      onMerge((current) => mergeOffProduct(current, product));
      notify.success(t("pantryItem.off.updated"));
    } finally {
      setIsDownloading(false);
    }
  };

  const share = async () => {
    if (!draft.name.trim()) {
      notify.error(t("pantryItem.off.nameRequired"));
      return;
    }
    setIsSharing(true);
    setVerification("none");
    try {
      if (await lookup()) {
        setPresence({ barcode, isOnOff: true });
        return;
      }
      await offContribute(
        {
          name: draft.name.trim(),
          brand: draft.brand.trim(),
          barcode,
          serving_size: Number(draft.serving_size) || null,
          serving_unit: draft.serving_unit,
          nutrition: draft.nutrition,
        },
        {
          username: settings.offUsername,
          password: settings.offPassword,
          uploadCountry: settings.offUploadCountry,
        },
        i18n.language,
      );
      notify.success(t("pantryItem.off.submitted"));
      setPresence({ barcode, isOnOff: true });
      setVerification("checking");
      setTimeout(() => {
        void lookup().then((found) => {
          setVerification(found ? "confirmed" : "pending");
        });
      }, VERIFY_DELAY_MS);
    } catch (error) {
      notify.failure(error, t("pantryItem.off.shareFailed"));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Stack gap={2}>
      <Row gap={2} shouldWrap align="center">
        {isOnOff ? (
          <ExternalLink
            href={`https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`}
            text={t("pantryItem.off.view")}
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            text={t("pantryItem.off.share")}
            isLoading={isSharing}
            onClick={() => void share()}
          >
            <Upload aria-hidden size={14} />
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          text={t("pantryItem.off.refresh")}
          isLoading={isDownloading}
          onClick={() => void download()}
        >
          <Download aria-hidden size={14} />
        </Button>
      </Row>
      {verification === "none" ? null : (
        <Text variant="caption" tone="muted" role="status">
          {t(`pantryItem.off.verify.${verification}`)}
        </Text>
      )}
    </Stack>
  );
}
