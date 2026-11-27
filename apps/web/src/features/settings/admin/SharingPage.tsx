/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
/** NutriTrace's sharing of foods, meals and recipes (Sharing.svelte) */
import {
  Button,
  Row,
  Spinner,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";

import { useAdminBackends } from "../common/admin";
import { CheckList, SelectRow, SwitchRow } from "../common/fields";
import { BoundSelect } from "../common/rows";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";

const KINDS = ["foods", "meals", "recipes"] as const;
type Kind = (typeof KINDS)[number];
type Visibility = "private" | "group" | "specific";

interface BulkChoice {
  visibility: Visibility;
  user_ids: number[];
}

interface Sharing {
  sharing_enabled: boolean;
  bulk?: Partial<Record<Kind, BulkChoice>>;
}

interface Member {
  id: number;
  name: string;
}

const PRIVATE: BulkChoice = { visibility: "private", user_ids: [] };

function BulkShare({
  stored,
  isAdmin,
}: {
  stored: Sharing["bulk"];
  isAdmin: boolean;
}) {
  const { t } = useTranslation("settings");
  const [form, setForm] = useState<Record<Kind, BulkChoice>>({
    foods: stored?.foods ?? PRIVATE,
    meals: stored?.meals ?? PRIVATE,
    recipes: stored?.recipes ?? PRIVATE,
  });
  const needsMembers = KINDS.some((k) => form[k].visibility === "specific");
  const members = useLoad(
    () =>
      needsMembers
        ? api.nt.get<Member[]>("/auth/users/list")
        : Promise.resolve<Member[]>([]),
    [needsMembers],
  );
  const { isBusy, run } = useAction();
  const set = (kind: Kind, patch: Partial<BulkChoice>) => {
    setForm((old) => ({ ...old, [kind]: { ...old[kind], ...patch } }));
  };

  const apply = () =>
    run(
      async () => {
        await Promise.all(
          KINDS.map((kind) =>
            api.nt.post("/foods/bulk-share", {
              visibility: form[kind].visibility,
              targets: [kind],
              ...(form[kind].visibility === "specific"
                ? { user_ids: form[kind].user_ids }
                : {}),
            }),
          ),
        );
        // The remembered form is server-wide config: admins only.
        if (!isAdmin) return;
        for (const kind of KINDS) {
          const { visibility, user_ids } = form[kind];
          await api.nt.put("/app-config", {
            key: `bulk_vis_${kind}`,
            value: visibility,
          });
          await api.nt.put("/app-config", {
            key: `bulk_users_${kind}`,
            value: JSON.stringify(visibility === "specific" ? user_ids : []),
          });
        }
      },
      { success: t("sharing.applied") },
    );

  return (
    <Section title={t("sharing.bulk")} hint={t("sharing.bulkHint")}>
      {KINDS.map((kind) => (
        <div key={kind} className="flex flex-col gap-2">
          <SelectRow<Visibility>
            label={t(`sharing.kinds.${kind}`)}
            value={form[kind].visibility}
            options={(["private", "group", "specific"] as const).map(
              (value) => ({
                value,
                label: t(`sharing.visibility.${value}`),
              }),
            )}
            onChange={(visibility) => {
              set(kind, { visibility });
            }}
          />
          {form[kind].visibility === "specific" ? (
            members.data ? (
              <CheckList<number>
                isInline
                label={t("sharing.members", {
                  kind: t(`sharing.kinds.${kind}`),
                })}
                options={members.data.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
                values={form[kind].user_ids}
                onChange={(user_ids) => {
                  set(kind, { user_ids });
                }}
              />
            ) : (
              <Spinner size="sm" label={t("loading")} />
            )
          ) : null}
        </div>
      ))}
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("sharing.apply")}
          isLoading={isBusy}
          onClick={() => void apply()}
        />
      </Row>
    </Section>
  );
}

export function SharingPage() {
  const { t } = useTranslation("settings");
  const isAdmin = useAdminBackends().includes("nt");
  const sharing = useLoad(() => api.nt.get<Sharing>("/app-config/sharing"), []);
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();

  const setEnabled = async (isOn: boolean) => {
    if (!isOn) {
      // The server makes everything private again; the old UI didn't ask.
      const isConfirmed = await confirm({
        title: t("sharing.disableTitle"),
        message: t("sharing.disableText"),
        confirmText: t("sharing.disable"),
        isDangerous: true,
      });
      if (!isConfirmed) return;
    }
    await run(async () => {
      await api.nt.put("/app-config", {
        key: "sharing_enabled",
        value: String(isOn),
      });
      await sharing.reload();
    });
  };

  return (
    <SettingsScreen
      title={t("topics.sharing.title")}
      description={t("topics.sharing.description")}
      backends={["nt"]}
    >
      <LoadState
        isLoading={sharing.isLoading}
        error={sharing.error}
        onRetry={() => void sharing.reload()}
        hasData={sharing.data !== null}
      >
        {sharing.data ? (
          <>
            {isAdmin ? (
              <SwitchRow
                label={t("sharing.enable")}
                hint={t("sharing.enableHint")}
                isChecked={sharing.data.sharing_enabled}
                isDisabled={isBusy}
                onChange={(isOn) => void setEnabled(isOn)}
              />
            ) : null}
            {sharing.data.sharing_enabled ? (
              <>
                <BoundSelect<string>
                  refs={[["nt", "defaultShareVisibility"]]}
                  label={t("sharing.defaultVisibility")}
                  options={(["private", "group"] as const).map((value) => ({
                    value,
                    label: t(`sharing.visibility.${value}`),
                  }))}
                />
                <BulkShare stored={sharing.data.bulk} isAdmin={isAdmin} />
              </>
            ) : (
              <Text tone="muted">{t("sharing.off")}</Text>
            )}
          </>
        ) : null}
      </LoadState>
      {dialog}
    </SettingsScreen>
  );
}
