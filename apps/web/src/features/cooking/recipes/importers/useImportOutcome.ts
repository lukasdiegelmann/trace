import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useNotify } from "../../common/useNotify";
import { readImportAnswer } from "../../lib/importing";

/** Tells what an import did and goes to the recipe, if there is one */
export function useImportOutcome(onImported: () => void) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const navigate = useNavigate();
  return useCallback(
    (value: unknown) => {
      const answer = readImportAnswer(value);
      if (answer.kind === "archive") {
        if (answer.count === 0) {
          notify.info(
            t("importers.outcome.allDuplicates", { count: answer.skipped }),
          );
        } else if (answer.skipped > 0) {
          notify.success(
            t("importers.outcome.importedSkipped", {
              count: answer.count,
              skipped: answer.skipped,
            }),
          );
        } else {
          notify.success(
            t("importers.outcome.imported", { count: answer.count }),
          );
        }
        onImported();
        return;
      }
      if (answer.kind === "duplicate") {
        notify.info(t("importers.outcome.duplicate"));
        if (answer.existingId !== null) {
          void navigate(`/cooking/recipes/${answer.existingId}`);
        }
        return;
      }
      if (answer.hasSteps) notify.success(t("importers.outcome.one"));
      else notify.error(t("importers.outcome.noSteps"));
      onImported();
      void navigate(`/cooking/recipes/${answer.id}`);
    },
    [navigate, notify, onImported, t],
  );
}
