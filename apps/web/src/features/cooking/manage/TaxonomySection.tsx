import {
  Button,
  Chip,
  InplaceMultiSelect,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Filter } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import {
  asTaxonomySort,
  mergeTarget,
  taxonomyView,
  type TaxonomySort,
} from "../lib/manage";
import { manageApi, type TaxonomyEntry, type TaxonomyKind } from "../manageApi";
import {
  EditDeleteButtons,
  ManageRow,
  SaveCancelButtons,
  SectionHead,
} from "./parts";

/** The old UI's localStorage names, so its choices carry over */
const STORAGE_NAMES: Record<TaxonomyKind, string> = {
  tags: "Tags",
  tools: "Kitchen Gear",
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the choice lasts for this visit.
  }
}

/** Tags and kitchen gear: renaming and deleting cascade through recipes */
export function TaxonomySection({ kind }: { kind: TaxonomyKind }) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const load = useCallback(() => manageApi.taxonomy(kind), [kind]);
  const { data, error, reload } = useLoad(load);
  const sortKey = `manage:sort:${STORAGE_NAMES[kind]}`;
  const unusedKey = `manage:unused:${STORAGE_NAMES[kind]}`;
  const [sort, setSort] = useState<TaxonomySort>(() =>
    asTaxonomySort(read(sortKey)),
  );
  const [isUnusedOnly, setIsUnusedOnly] = useState(
    () => read(unusedKey) === "1",
  );
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<{ name: string; next: string } | null>(null);

  const items = data ?? [];
  const shown = taxonomyView(items, filter, sort, isUnusedOnly);
  const uses = items.reduce((sum, item) => sum + item.count, 0);
  const unused = items.filter((item) => item.count === 0).length;
  const section = kind === "tags" ? "tags" : "kitchen-gear";

  const rename = async () => {
    if (!edit) return;
    const next = edit.next.trim();
    if (!next || next.toLowerCase() === edit.name.toLowerCase()) {
      setEdit(null);
      return;
    }
    const target = mergeTarget(items, edit.name, next);
    if (target) {
      const isConfirmed = await confirm({
        title: t("manage.taxonomy.mergeTitle", {
          name: edit.name,
          target: target.name,
        }),
        message: t("manage.taxonomy.mergeMessage", {
          name: edit.name,
          target: target.name,
        }),
        confirmText: t("manage.taxonomy.merge"),
      });
      if (!isConfirmed) return;
    }
    try {
      const result = await manageApi.renameTaxonomy(kind, edit.name, next);
      setEdit(null);
      await reload({ isQuiet: true });
      notify.success(t("manage.taxonomy.updated", { count: result.modified }));
    } catch (caught) {
      notify.failure(caught, t("manage.toast.renameFailed"));
    }
  };

  const remove = async (item: TaxonomyEntry) => {
    const isConfirmed = await confirm({
      title: t("manage.confirmDelete", { name: item.name }),
      message: t("manage.taxonomy.deleteMessage", { count: item.count }),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    try {
      const result = await manageApi.removeTaxonomy(kind, item.name);
      await reload({ isQuiet: true });
      notify.success(
        t("manage.taxonomy.removedFrom", { count: result.modified }),
      );
    } catch (caught) {
      notify.failure(caught, t("manage.toast.deleteFailed"));
    }
  };

  return (
    <Stack gap={3}>
      <SectionHead
        title={t(`manage.sections.${section}.label`)}
        text={t(`manage.taxonomy.${kind}Description`)}
      />
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <Text tone="muted">{t("manage.taxonomy.empty")}</Text>
      ) : (
        <>
          <Row gap={3} align="center" shouldWrap>
            <Text variant="small">
              {t("manage.itemCount", { count: items.length })}
            </Text>
            <Text variant="small" tone="muted">
              {t("manage.taxonomy.usesAcross", { count: uses })}
            </Text>
            {unused > 0 || isUnusedOnly ? (
              <Button
                size="sm"
                variant={isUnusedOnly ? "primary" : "secondary"}
                aria-pressed={isUnusedOnly}
                text={t("manage.taxonomy.unused", { count: unused })}
                onClick={() => {
                  setIsUnusedOnly(!isUnusedOnly);
                  write(unusedKey, isUnusedOnly ? "0" : "1");
                }}
              >
                <Filter aria-hidden size={14} />
              </Button>
            ) : null}
            {items.length > 1 ? (
              <InplaceMultiSelect
                label={t("manage.taxonomy.sort")}
                value={sort}
                options={(["name", "most", "least"] as const).map((value) => ({
                  value,
                  label: t(`manage.taxonomy.sortBy.${value}`),
                }))}
                onChange={(value) => {
                  const next = asTaxonomySort(value);
                  setSort(next);
                  write(sortKey, next);
                }}
              />
            ) : null}
          </Row>
          <Input
            type="search"
            label={t("cookingCommon.filter")}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
            }}
          />
          {shown.length === 0 ? (
            <Text tone="muted">{t("manage.noMatch", { query: filter })}</Text>
          ) : null}
          <Stack gap={2} as="ul">
            {shown.map((item) => (
              <ManageRow key={item.name}>
                {edit?.name === item.name ? (
                  <Stack gap={2} fill="width">
                    <Input
                      label={t("manage.name")}
                      value={edit.next}
                      autoFocus
                      onChange={(event) => {
                        setEdit({ ...edit, next: event.target.value });
                      }}
                      onEnter={() => void rename()}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEdit(null);
                        }
                      }}
                    />
                    <SaveCancelButtons
                      canSave={Boolean(edit.next.trim())}
                      onSave={() => void rename()}
                      onCancel={() => {
                        setEdit(null);
                      }}
                    />
                  </Stack>
                ) : (
                  <>
                    <Text as="span" className="min-w-0 flex-1">
                      {item.name}
                    </Text>
                    <Chip
                      tone="muted"
                      text={t("manage.uses", { count: item.count })}
                    />
                    <EditDeleteButtons
                      name={item.name}
                      editLabel={t("manage.renameNamed", { name: item.name })}
                      onEdit={() => {
                        setEdit({ name: item.name, next: item.name });
                      }}
                      onDelete={() => void remove(item)}
                    />
                  </>
                )}
              </ManageRow>
            ))}
          </Stack>
        </>
      )}
      {dialog}
    </Stack>
  );
}
