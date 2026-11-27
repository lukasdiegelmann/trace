import {
  Avatar,
  Button,
  CodeBlock,
  Disclosure,
  EmptyState,
  ExternalLink,
  FileInput,
  KeyValue,
  ProgressBar,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useAdminBackends } from "../common/admin";
import { SecretRow, SwitchRow, TextRow } from "../common/fields";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { backendAssetUrl } from "../lib/assets";
import { catalogNameFromFile, inPool, parseCatalogJson } from "../lib/catalog";
import { catalogApi, customExercises, type ExerciseSource } from "./catalogApi";

const FORMAT_EXAMPLE = `{
  "exercises": [
    {
      "name": "Cable Crossover",
      "category": "chest",
      "equipment": ["Cable"],
      "primary_muscles": ["chest"],
      "secondary_muscles": ["front delts"],
      "instructions": "…",
      "img_url": "https://…"
    }
  ]
}`;

function Sources() {
  const { t } = useTranslation("settings");
  const isAdmin = useAdminBackends().includes("lt");
  const sources = useLoad(() => catalogApi.sources(), []);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();

  const during = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    await run(async () => {
      await action();
      await sources.reload();
    });
    setBusyId(null);
  };

  const importSource = (source: ExerciseSource) => {
    const key = (keys[source.id] ?? "").trim() || undefined;
    if (source.requiresKey && !key) {
      toast.error(t("catalog.needsKey", { name: source.name }));
      return;
    }
    void during(source.id, async () => {
      const { count } = await catalogApi.importSource(source.id, key);
      toast.show({
        text: t("catalog.imported", { name: source.name, count }),
      });
    });
  };

  const clear = async (source: ExerciseSource) => {
    const isConfirmed = await confirm({
      title: t("catalog.clearTitle"),
      message: t("catalog.clearText", {
        name: source.name,
        count: source.count,
      }),
      confirmText: t("catalog.clear"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await during(source.id, () => catalogApi.clearSource(source.id));
  };

  return (
    <Section
      title={t("catalog.sources")}
      hint={isAdmin ? undefined : t("catalog.adminOnly")}
    >
      <LoadState
        isLoading={sources.isLoading}
        error={sources.error}
        onRetry={() => void sources.reload()}
        hasData={sources.data !== null}
      >
        {sources.data?.map((source) => (
          <Stack key={source.id} gap={2}>
            <KeyValue
              label={source.name}
              hint={source.description}
              value={t("catalog.count", { count: source.count })}
            />
            {source.count > 0 ? (
              <SwitchRow
                label={t("catalog.show", { name: source.name })}
                isChecked={source.enabled}
                onChange={(isOn) =>
                  void during(source.id, () =>
                    catalogApi.toggleSource(source.id, isOn),
                  )
                }
              />
            ) : null}
            {isAdmin && source.requiresKey ? (
              <SecretRow
                label={t("catalog.rapidApiKey")}
                hint={t("catalog.byokNote")}
                value={keys[source.id] ?? ""}
                onCommit={(key) => {
                  setKeys((old) => ({ ...old, [source.id]: key }));
                }}
              />
            ) : null}
            {isAdmin ? (
              <Row gap={2}>
                <Button
                  variant="secondary"
                  size="sm"
                  text={t(
                    source.count > 0 ? "catalog.reimport" : "actions.import",
                  )}
                  isLoading={busyId === source.id}
                  isDisabled={busyId !== null}
                  onClick={() => {
                    importSource(source);
                  }}
                />
                {source.count > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("catalog.clear")}
                    isDisabled={busyId !== null}
                    onClick={() => void clear(source)}
                  />
                ) : null}
              </Row>
            ) : null}
          </Stack>
        ))}
      </LoadState>
      {dialog}
    </Section>
  );
}

function OfflineMedia() {
  const { t } = useTranslation("settings");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const { isBusy, run } = useAction();
  const toast = useToast();

  const precache = () =>
    run(async () => {
      const { urls } = await catalogApi.mediaUrls();
      let done = 0;
      setProgress({ done, total: urls.length });
      await inPool(urls, 8, async (url) => {
        try {
          // The service worker keeps what passes through it.
          await fetch(backendAssetUrl("lt", url), { mode: "no-cors" });
        } catch {
          // One missing picture doesn't stop the rest.
        }
        done += 1;
        setProgress({ done, total: urls.length });
      });
      toast.show({ text: t("catalog.precacheDone", { count: urls.length }) });
    });

  return (
    <Section title={t("catalog.offline")} hint={t("catalog.offlineHint")}>
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("catalog.precache")}
          isLoading={isBusy}
          onClick={() => void precache()}
        />
      </Row>
      {progress ? (
        <ProgressBar
          value={progress.total ? progress.done / progress.total : 1}
          label={t("catalog.precached", progress)}
        />
      ) : null}
    </Section>
  );
}

function OwnExercises() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const exercises = useLoad(() => catalogApi.exercises(), []);
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();
  const own = customExercises(exercises.data ?? []);

  const remove = async (
    title: string,
    message: string,
    action: () => Promise<unknown>,
  ) => {
    const isConfirmed = await confirm({
      title,
      message,
      confirmText: t("actions.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await action();
      await exercises.reload();
    });
  };

  return (
    <Section title={t("catalog.own")} hint={t("catalog.ownHint")}>
      <LoadState
        isLoading={exercises.isLoading}
        error={exercises.error}
        onRetry={() => void exercises.reload()}
        hasData={exercises.data !== null}
      >
        {own.length === 0 ? (
          <EmptyState text={t("catalog.noOwn")} />
        ) : (
          <Text variant="small" tone="muted">
            {t("catalog.ownCount", { count: own.length })}
          </Text>
        )}
        {own.map((exercise) => (
          <Row key={exercise.id} gap={2} align="center">
            <Avatar
              name={exercise.name}
              src={
                exercise.img_url
                  ? backendAssetUrl("lt", exercise.img_url)
                  : null
              }
              size={32}
            />
            <div className="min-w-0 flex-1">
              <KeyValue
                label={exercise.name}
                hint={[
                  exercise.category,
                  ...(exercise.primary_muscles ?? []).slice(0, 3),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={
                  <Row gap={2}>
                    <Button
                      variant="ghost"
                      size="sm"
                      text={t("actions.edit")}
                      aria-label={`${t("actions.edit")}: ${exercise.name}`}
                      onClick={() =>
                        void navigate(`/training/exercises/${exercise.id}`)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("actions.removeNamed", {
                        name: exercise.name,
                      })}
                      onClick={() =>
                        void remove(
                          t("catalog.deleteTitle", { name: exercise.name }),
                          t("catalog.deleteText"),
                          () => catalogApi.deleteExercise(exercise.id),
                        )
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </Row>
                }
              />
            </div>
          </Row>
        ))}
      </LoadState>
      <Row gap={2} shouldWrap>
        <Button
          variant="secondary"
          size="md"
          text={t("catalog.createInTraining")}
          onClick={() => void navigate("/training/exercises")}
        />
        {own.length > 0 ? (
          <Button
            variant="danger"
            size="md"
            text={t("catalog.deleteAll")}
            onClick={() =>
              void remove(
                t("catalog.deleteAll"),
                t("catalog.deleteAllText", { count: own.length }),
                () => catalogApi.deleteCustom(),
              )
            }
          />
        ) : null}
      </Row>
      {dialog}
    </Section>
  );
}

function JsonCatalogs() {
  const { t } = useTranslation("settings");
  const catalogs = useLoad(() => catalogApi.catalogs(), []);
  const [name, setName] = useState("");
  const [json, setJson] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();

  const pick = async (picked: File | null) => {
    setFile(picked);
    if (!picked) return;
    setJson(await picked.text());
    setName((old) => old || catalogNameFromFile(picked.name));
  };

  const submit = async () => {
    setResult(null);
    if (!name.trim()) {
      setProblem(t("catalog.json.errors.name"));
      return;
    }
    const parsed = parseCatalogJson(json);
    if ("error" in parsed) {
      setProblem(
        `${t(`catalog.json.errors.${parsed.error}`)}${parsed.detail ? ` (${parsed.detail})` : ""}`,
      );
      return;
    }
    setProblem(null);
    await run(async () => {
      const answer = await catalogApi.importJson(name.trim(), parsed.exercises);
      setResult(
        t("catalog.json.result", {
          count: answer.count,
          name: answer.catalogName,
          duplicates: answer.duplicates ?? 0,
          skipped: answer.skipped ?? 0,
        }),
      );
      setName("");
      setJson("");
      setFile(null);
      await catalogs.reload();
    });
  };

  return (
    <Section title={t("catalog.json.title")}>
      <ExternalLink
        href="/lt/lifttrace-catalog-template.json"
        text={t("catalog.json.template")}
      />
      <Disclosure title={t("catalog.json.format")}>
        <CodeBlock code={FORMAT_EXAMPLE} language="json" />
      </Disclosure>
      <FileInput
        accept=".json,application/json"
        text={t("catalog.json.pick")}
        placeholder={t("catalog.json.noFile")}
        file={file}
        onChange={(picked) => void pick(picked)}
      />
      <TextRow
        label={t("catalog.json.name")}
        value={name}
        isLive
        onCommit={setName}
      />
      <TextRow
        isMultiline
        label={t("catalog.json.content")}
        value={json}
        isLive
        onCommit={setJson}
        error={problem ?? undefined}
      />
      <Row gap={2}>
        <Button
          variant="secondary"
          size="md"
          text={t("actions.import")}
          isLoading={isBusy}
          isDisabled={!json.trim()}
          onClick={() => void submit()}
        />
        <Button
          variant="ghost"
          size="md"
          text={t("catalog.json.clear")}
          onClick={() => {
            setJson("");
            setFile(null);
            setProblem(null);
          }}
        />
      </Row>
      {result ? (
        <Text role="status" tone="success">
          {result}
        </Text>
      ) : null}
      {[...(catalogs.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((catalog) => (
          <Row key={catalog.id} gap={2} align="center">
            <div className="min-w-0 flex-1">
              <SwitchRow
                label={`${catalog.name} (${catalog.count})`}
                isChecked={catalog.enabled}
                onChange={(isOn) =>
                  void run(async () => {
                    await catalogApi.toggleCatalog(catalog.name, isOn);
                    await catalogs.reload();
                  })
                }
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("actions.removeNamed", { name: catalog.name })}
              onClick={() =>
                void confirm({
                  title: t("catalog.json.deleteTitle", { name: catalog.name }),
                  message: t("catalog.json.deleteText", {
                    count: catalog.count,
                  }),
                  confirmText: t("actions.delete"),
                  isDangerous: true,
                }).then((isConfirmed) => {
                  if (!isConfirmed) return;
                  void run(async () => {
                    await catalogApi.deleteCatalog(catalog.name);
                    await catalogs.reload();
                  });
                })
              }
            >
              <X aria-hidden />
            </Button>
          </Row>
        ))}
      {dialog}
    </Section>
  );
}

export function CatalogPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.catalog.title")}
      description={t("topics.catalog.description")}
    >
      <Sources />
      <OfflineMedia />
      <OwnExercises />
      <JsonCatalogs />
    </SettingsScreen>
  );
}
