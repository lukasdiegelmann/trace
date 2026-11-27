/** The wizard's exercise library step: import sources, two at a time */
import {
  Button,
  EmptyState,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAdminBackends } from "../common/admin";
import { CheckList, SecretRow } from "../common/fields";
import { LoadState } from "../common/SettingsScreen";
import { errorText, useAction } from "../common/useAction";
import { useLoad } from "../common/useLoad";
import { inPool, sourceLicense } from "../lib/catalog";
import { catalogApi } from "../training/catalogApi";

export function LibraryStep() {
  const { t } = useTranslation("settings");
  const isAdmin = useAdminBackends().includes("lt");
  const sources = useLoad(() => catalogApi.sources(), []);
  const [chosen, setChosen] = useState<string[]>(["free-db"]);
  const [keys, setKeys] = useState<Partial<Record<string, string>>>({});
  const [done, setDone] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { isBusy, run } = useAction();

  if (!isAdmin) return <EmptyState text={t("catalog.adminOnly")} />;
  const open = (sources.data ?? []).filter((source) => source.count === 0);
  const picked = open.filter((source) => chosen.includes(source.id));

  const importAll = () =>
    run(async () => {
      let finished = 0;
      setDone(0);
      setErrors([]);
      await inPool(picked, 2, async (source) => {
        try {
          await catalogApi.importSource(source.id, keys[source.id]);
        } catch (caught) {
          setErrors((old) => [...old, `${source.name}: ${errorText(caught)}`]);
        }
        finished += 1;
        setDone(finished);
      });
      await sources.reload();
    });

  return (
    <LoadState
      isLoading={sources.isLoading}
      error={sources.error}
      onRetry={() => void sources.reload()}
      hasData={sources.data !== null}
    >
      <Stack gap={3}>
        {open.length === 0 ? (
          <Text>{t("wizard.libraryDone")}</Text>
        ) : (
          <>
            <CheckList<string>
              label={t("catalog.sources")}
              options={open.map((source) => {
                const license = sourceLicense(source.id);
                return {
                  value: source.id,
                  label: [
                    source.name,
                    source.description,
                    license
                      ? `${license.label} (${t(`catalog.licenseNotes.${license.note}`)})`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                };
              })}
              values={chosen}
              onChange={setChosen}
            />
            {picked
              .filter((source) => source.requiresKey)
              .map((source) => (
                <SecretRow
                  key={source.id}
                  label={`${t("catalog.rapidApiKey")} (${source.name})`}
                  hint={t("catalog.byokNote")}
                  value={keys[source.id] ?? ""}
                  onCommit={(key) => {
                    setKeys((old) => ({ ...old, [source.id]: key }));
                  }}
                />
              ))}
            <Row>
              <Button
                variant="secondary"
                size="md"
                text={t("actions.import")}
                isLoading={isBusy}
                isDisabled={
                  picked.length === 0 ||
                  picked.some((s) => s.requiresKey && !keys[s.id])
                }
                onClick={() => void importAll()}
              />
            </Row>
          </>
        )}
        {done !== null && picked.length > 0 ? (
          <ProgressBar
            value={done / picked.length}
            label={t("connections.progress", { done, total: picked.length })}
          />
        ) : null}
        {errors.map((error) => (
          <Text key={error} variant="small" tone="danger">
            {error}
          </Text>
        ))}
      </Stack>
    </LoadState>
  );
}
