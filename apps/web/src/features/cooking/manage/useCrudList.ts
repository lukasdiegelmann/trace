import { useTranslation } from "react-i18next";

import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import { moveItem } from "../lib/manage";

/** A list the Manage hub edits: load, reorder, delete. Pass a stable loader */
export function useCrudList<T extends { id: number; name?: string }>(
  loader: () => Promise<T[]>,
) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const { data, error, reload, setData } = useLoad(loader);

  /** Runs a change; failures are toasted */
  const run = async (work: () => Promise<void>, failed: string) => {
    try {
      await work();
      return true;
    } catch (caught) {
      notify.failure(caught, failed);
      return false;
    }
  };

  const move = async (
    id: number,
    delta: -1 | 1,
    save: (ids: number[]) => Promise<unknown>,
  ) => {
    const list = data ?? [];
    const next = moveItem(
      list,
      list.findIndex((item) => item.id === id),
      delta,
    );
    if (!next) return;
    setData(() => next);
    const isSaved = await run(async () => {
      await save(next.map((item) => item.id));
    }, t("manage.toast.orderFailed"));
    if (!isSaved) await reload({ isQuiet: true });
  };

  const remove = async (
    item: T,
    question: { title: string; message: string },
    work: () => Promise<unknown>,
  ) => {
    const isConfirmed = await confirm({
      ...question,
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await work();
      setData((list) => list.filter((entry) => entry.id !== item.id));
    }, t("manage.toast.deleteFailed"));
  };

  return { items: data, error, reload, setData, run, move, remove, dialog };
}
