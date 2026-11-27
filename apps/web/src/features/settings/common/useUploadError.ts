import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { uploadProblem } from "../lib/uploadError";

/** Rethrows an upload's failure with a text that says what to do */
export function useUploadError(): <T>(upload: Promise<T>) => Promise<T> {
  const { t } = useTranslation("settings");
  return useCallback(
    async <T>(upload: Promise<T>) => {
      try {
        return await upload;
      } catch (caught) {
        const problem = uploadProblem(caught);
        if (!problem) throw caught;
        throw new Error(t(`importExport.uploadErrors.${problem}`), {
          cause: caught,
        });
      }
    },
    [t],
  );
}
