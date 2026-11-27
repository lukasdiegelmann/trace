import {
  Button,
  Checkbox,
  Chip,
  InplaceMultiSelect,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import { refreshUnits } from "../common/useUnits";
import { customAsUnit, customUnitProblem, matchesUnit } from "../lib/manage";
import {
  BUILTIN_UNIT_ABBRS,
  CUSTOM_UNIT_CATEGORY,
  UNIT_GROUPS,
  unitGroupLabelKey,
  type CustomUnit,
} from "../lib/units";
import { manageApi } from "../manageApi";
import {
  EditDeleteButtons,
  ManageRow,
  SaveCancelButtons,
  SectionHead,
} from "./parts";

interface Fields {
  abbr: string;
  full: string;
  category: string;
}

const BLANK: Fields = { abbr: "", full: "", category: CUSTOM_UNIT_CATEGORY };

function UnitFields({
  value,
  onChange,
  onSubmit,
}: {
  value: Fields;
  onChange: (fields: Fields) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation("cooking");
  const categories = [
    ...UNIT_GROUPS.map((group) => group.label),
    CUSTOM_UNIT_CATEGORY,
  ];
  return (
    <Row gap={2} align="end" shouldWrap>
      <Input
        label={t("manage.units.abbr")}
        placeholder={t("manage.units.abbrPlaceholder")}
        value={value.abbr}
        wrapperClassName="w-32"
        onChange={(event) => {
          onChange({ ...value, abbr: event.target.value });
        }}
        onEnter={onSubmit}
      />
      <Input
        label={t("manage.units.fullName")}
        value={value.full}
        wrapperClassName="min-w-40 flex-1"
        onChange={(event) => {
          onChange({ ...value, full: event.target.value });
        }}
        onEnter={onSubmit}
      />
      <InplaceMultiSelect
        label={t("manage.units.category")}
        value={value.category}
        options={categories.map((category) => ({
          value: category,
          label: t(
            `cookingCommon.unitGroups.${(unitGroupLabelKey(category) ?? "custom") as "custom"}`,
          ),
        }))}
        onChange={(category) => {
          onChange({ ...value, category });
        }}
      />
    </Row>
  );
}

/** Built-ins can be hidden from the pickers; custom units are added */
export function UnitsSection() {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const load = useCallback(() => manageApi.units(), []);
  const { data, error, reload, setData } = useLoad(load);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Fields>(BLANK);
  const [edit, setEdit] = useState<{ unit: CustomUnit; fields: Fields } | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);

  const disabled = new Set(data?.disabled);
  const custom = data?.custom ?? [];
  const uses = (abbr: string) => data?.usage[abbr.toLowerCase()] ?? 0;

  const groups = UNIT_GROUPS.map((group) => ({
    ...group,
    units: group.units.filter((unit) => matchesUnit(unit, filter)),
  })).filter((group) => group.units.length > 0);
  const shownCustom = custom.filter((unit) =>
    matchesUnit(customAsUnit(unit), filter),
  );
  const isNothingShown =
    Boolean(filter.trim()) && groups.length === 0 && shownCustom.length === 0;

  const attempt = async (work: () => Promise<void>, failed: string) => {
    try {
      await work();
      void refreshUnits();
      return true;
    } catch (caught) {
      notify.failure(caught, failed);
      return false;
    }
  };

  const toggle = (abbr: string) => {
    const isDisabling = !disabled.has(abbr);
    void attempt(async () => {
      await manageApi.setBuiltinUnit(abbr, isDisabling);
      setData((current) => ({
        ...current,
        disabled: isDisabling
          ? [...current.disabled, abbr]
          : current.disabled.filter((entry) => entry !== abbr),
      }));
    }, t("manage.toast.saveFailed"));
  };

  const restoreAll = async () => {
    const isConfirmed = await confirm({
      title: t("manage.units.restoreTitle"),
      message: t("manage.units.restoreMessage"),
      confirmText: t("manage.units.restoreConfirm"),
    });
    if (!isConfirmed) return;
    const isDone = await attempt(async () => {
      for (const abbr of disabled) {
        await manageApi.setBuiltinUnit(abbr, false);
      }
    }, t("manage.toast.saveFailed"));
    await reload({ isQuiet: true });
    if (isDone) notify.success(t("manage.units.restored"));
  };

  const payload = (fields: Fields) => ({
    abbr: fields.abbr.trim(),
    full_name: fields.full.trim() || fields.abbr.trim(),
    category: fields.category,
  });

  const create = async () => {
    if (!draft.abbr.trim() || isCreating) return;
    const problem = customUnitProblem(draft.abbr, custom);
    if (problem) {
      notify.error(
        t(`manage.units.problem.${problem}`, { abbr: draft.abbr.trim() }),
      );
      return;
    }
    setIsCreating(true);
    await attempt(async () => {
      const created = await manageApi.createUnit(payload(draft));
      setData((current) => ({
        ...current,
        custom: [...current.custom, created],
      }));
      setDraft({ ...BLANK, category: draft.category });
      notify.success(t("manage.units.added"));
    }, t("manage.toast.addFailed"));
    setIsCreating(false);
  };

  const save = async () => {
    if (!edit?.fields.abbr.trim()) return;
    await attempt(async () => {
      const updated = await manageApi.updateUnit(edit.unit.id, {
        ...payload(edit.fields),
        _base: edit.unit,
      });
      setData((current) => ({
        ...current,
        custom: current.custom.map((unit) =>
          unit.id === updated.id ? updated : unit,
        ),
      }));
      setEdit(null);
      notify.success(t("manage.toast.saved"));
    }, t("manage.toast.saveFailed"));
  };

  const remove = async (unit: CustomUnit) => {
    const isConfirmed = await confirm({
      title: t("manage.confirmDelete", { name: unit.abbr }),
      message: t("manage.units.deleteMessage"),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await attempt(async () => {
      await manageApi.removeUnit(unit.id);
      setData((current) => ({
        ...current,
        custom: current.custom.filter((entry) => entry.id !== unit.id),
      }));
    }, t("manage.toast.deleteFailed"));
  };

  const usageChip = (abbr: string) => (
    <Chip tone="muted" text={t("manage.uses", { count: uses(abbr) })} />
  );

  return (
    <Stack gap={4}>
      <SectionHead
        title={t("manage.sections.units.label")}
        text={t("manage.units.description")}
      />
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <Row gap={3} align="center" shouldWrap>
            <Text variant="small">
              {t("manage.units.builtins", {
                count: BUILTIN_UNIT_ABBRS.size,
                hidden: disabled.size,
              })}
            </Text>
            <Text variant="small" tone="muted">
              {t("manage.units.customCount", { count: custom.length })}
            </Text>
            {disabled.size > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                text={t("manage.units.restoreAll")}
                onClick={() => void restoreAll()}
              />
            ) : null}
          </Row>
          <Input
            type="search"
            label={t("manage.units.filter")}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
            }}
          />
          {isNothingShown ? (
            <Text tone="muted">{t("manage.noMatch", { query: filter })}</Text>
          ) : null}
          {groups.map((group) => (
            <Stack key={group.label} gap={2} as="section">
              <Text variant="label">
                {t(`cookingCommon.unitGroups.${group.labelKey as "custom"}`)}
              </Text>
              <Stack gap={1} as="ul">
                {group.units.map((unit) => (
                  <ManageRow key={unit.abbr} isMuted={disabled.has(unit.abbr)}>
                    {/* TODO(monolithium): a switch */}
                    <Checkbox
                      checked={!disabled.has(unit.abbr)}
                      label={
                        <span className="sr-only">
                          {t("manage.units.visible", { abbr: unit.abbr })}
                        </span>
                      }
                      onChange={() => {
                        toggle(unit.abbr);
                      }}
                    />
                    <Text as="span">
                      <strong>{unit.abbr}</strong>
                    </Text>
                    <Text as="span" tone="muted" className="min-w-0 flex-1">
                      {unit.full}
                    </Text>
                    <Chip tone="muted" text={t("manage.units.builtin")} />
                    {usageChip(unit.abbr)}
                  </ManageRow>
                ))}
              </Stack>
            </Stack>
          ))}
          <Stack gap={2} as="section">
            <Text variant="label">{t("manage.units.customTitle")}</Text>
            {custom.length === 0 ? (
              <Text tone="muted">{t("manage.units.noCustom")}</Text>
            ) : null}
            <Stack gap={1} as="ul">
              {shownCustom.map((unit) => (
                <ManageRow key={unit.id}>
                  {edit?.unit.id === unit.id ? (
                    <Stack gap={2} fill="width">
                      <UnitFields
                        value={edit.fields}
                        onChange={(fields) => {
                          setEdit({ ...edit, fields });
                        }}
                        onSubmit={() => void save()}
                      />
                      <SaveCancelButtons
                        canSave={Boolean(edit.fields.abbr.trim())}
                        onSave={() => void save()}
                        onCancel={() => {
                          setEdit(null);
                        }}
                      />
                    </Stack>
                  ) : (
                    <>
                      <Text as="span">
                        <strong>{unit.abbr}</strong>
                      </Text>
                      <Text as="span" tone="muted" className="min-w-0 flex-1">
                        {unit.full_name}
                      </Text>
                      {unit.category ? (
                        <Chip
                          tone="muted"
                          text={
                            unitGroupLabelKey(unit.category)
                              ? t(
                                  `cookingCommon.unitGroups.${unitGroupLabelKey(unit.category) as "custom"}`,
                                )
                              : unit.category
                          }
                        />
                      ) : null}
                      {usageChip(unit.abbr)}
                      <EditDeleteButtons
                        name={unit.abbr}
                        onEdit={() => {
                          setEdit({
                            unit,
                            fields: {
                              abbr: unit.abbr,
                              full: unit.full_name ?? "",
                              category: unit.category || CUSTOM_UNIT_CATEGORY,
                            },
                          });
                        }}
                        onDelete={() => void remove(unit)}
                      />
                    </>
                  )}
                </ManageRow>
              ))}
            </Stack>
            <UnitFields
              value={draft}
              onChange={setDraft}
              onSubmit={() => void create()}
            />
            <Button
              size="md"
              variant="primary"
              text={t("manage.units.add")}
              isDisabled={!draft.abbr.trim() || isCreating}
              onClick={() => void create()}
            >
              <Plus aria-hidden size={16} />
            </Button>
          </Stack>
        </>
      )}
      {dialog}
    </Stack>
  );
}
