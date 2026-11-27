/**
 * Trace AI's settings, the same in all three apps (SettingsTrace.svelte of
 * each): one choice here is written to each backend, CookTrace's
 * compatible provider under its name "custom".
 */
import {
  Banner,
  ExternalLink,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AI_MODELS,
  AI_PROVIDERS,
  aiErrorText,
  askAi,
  CUSTOM_MODEL,
  DEFAULT_MODELS,
  PROVIDER_NAMES,
  readProvider,
  renamedModel,
  type AiProvider,
} from "@/features/shared/ai";

import {
  flushSettings,
  useShared,
  writeRef,
  type SettingRef,
  type ValueMap,
} from "../common/binding";
import { ConnectionCheck } from "../common/ConnectionCheck";
import { SecretRow, SelectRow, TextRow } from "../common/fields";
import { BoundSwitch } from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useEnvLocks } from "../common/envLocks";
import { useConnectionCheck } from "../common/useConnectionCheck";
import { VOICE_LANGUAGES } from "../lib/voiceLanguages";

const cookProvider: ValueMap<string> = {
  fromBackend: readProvider,
  toBackend: (value) => (value === "oai-compat" ? "custom" : value),
};

const KEY_LINKS: Partial<Record<AiProvider, string>> = {
  claude: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/app/apikey",
};

/** One AI setting in all three apps */
function everywhere(
  key:
    | "aiEnabled"
    | "aiModel"
    | "aiBaseUrl"
    | "aiApiKey"
    | "aiAssistantName"
    | "aiKeyVerified"
    | "smartLogVoiceLang",
): [SettingRef, ...SettingRef[]] {
  return [
    ["nt", key],
    ["ct", key],
    ["lt", key],
  ];
}

function Provider({
  isLocked,
  lockedProvider,
  lockedModel,
}: {
  isLocked: boolean;
  lockedProvider?: string;
  lockedModel?: string;
}) {
  const { t } = useTranslation("settings");
  const [stored, setProvider] = useShared<string>(
    ["nt", "aiProvider"],
    ["ct", "aiProvider", cookProvider],
    ["lt", "aiProvider"],
  );
  const [storedModel, setModel] = useShared<string>(...everywhere("aiModel"));
  const [baseUrl, setBaseUrl] = useShared<string>(...everywhere("aiBaseUrl"));
  const [apiKey, setApiKey] = useShared<string>(...everywhere("aiApiKey"));
  const [isVerified] = useShared<boolean>(...everywhere("aiKeyVerified"));
  const provider = readProvider(lockedProvider ?? stored);
  const model = renamedModel(lockedModel ?? storedModel);
  const list = provider === "oai-compat" ? [] : AI_MODELS[provider];
  const isListed = list.some((entry) => entry.value === model);
  const [isCustom, setIsCustom] = useState(false);
  const isCustomShown = isCustom || (model !== "" && !isListed);
  const choice = isCustomShown
    ? CUSTOM_MODEL
    : model || (provider === "oai-compat" ? "" : DEFAULT_MODELS[provider]);

  const setVerified = (isOk: boolean) => {
    for (const ref of everywhere("aiKeyVerified")) writeRef(ref, isOk);
  };
  const check = useConnectionCheck(async () => {
    await flushSettings("nt", "ct", "lt");
    try {
      await askAi(
        {
          provider,
          apiKey,
          model: storedModel,
          baseUrl,
        },
        {
          systemPrompt: "You are a connection test.",
          messages: [{ role: "user", content: 'Say "hi" in one word.' }],
        },
        isLocked,
      );
      setVerified(true);
    } catch (caught) {
      setVerified(false);
      throw new Error(aiErrorText(caught), { cause: caught });
    }
  });
  /** A change of what is tested voids the last result */
  const changed = (isAutoTest: boolean) => {
    check.reset();
    setVerified(false);
    if (isAutoTest) setTimeout(() => void check.run(), 0);
  };
  const isConfigured =
    isLocked ||
    (provider === "oai-compat"
      ? Boolean(baseUrl && storedModel)
      : Boolean(apiKey));
  const keyLink = KEY_LINKS[provider];

  return (
    <Section title={t("assistant.model")}>
      <SelectRow<AiProvider>
        label={t("assistant.provider")}
        value={provider}
        isDisabled={isLocked}
        options={AI_PROVIDERS.map((value) => ({
          value,
          label: PROVIDER_NAMES[value],
        }))}
        onChange={(next) => {
          setProvider(next);
          // Another provider's model means nothing here.
          setModel("");
          setIsCustom(false);
          changed(false);
        }}
      />
      {provider === "oai-compat" ? (
        <>
          <TextRow
            type="url"
            label={t("assistant.baseUrl")}
            hint={t("assistant.baseUrlHint")}
            placeholder="http://localhost:11434/v1"
            value={baseUrl}
            isDisabled={isLocked}
            onCommit={(value) => {
              setBaseUrl(value);
              changed(Boolean(value && storedModel));
            }}
          />
          <TextRow
            label={t("assistant.modelName")}
            hint={t("assistant.reliability")}
            value={model}
            isDisabled={isLocked}
            onCommit={(value) => {
              setModel(value);
              changed(Boolean(value && baseUrl));
            }}
          />
        </>
      ) : (
        <>
          <SelectRow<string>
            label={t("assistant.model")}
            value={choice}
            isDisabled={isLocked}
            options={[
              ...list,
              { value: CUSTOM_MODEL, label: t("assistant.customModel") },
            ]}
            onChange={(next) => {
              setIsCustom(next === CUSTOM_MODEL);
              if (next === CUSTOM_MODEL) return;
              setModel(next);
              changed(Boolean(apiKey));
            }}
          />
          {isCustomShown ? (
            <TextRow
              label={t("assistant.modelName")}
              value={isListed ? "" : model}
              isDisabled={isLocked}
              onCommit={(value) => {
                setModel(value);
                changed(Boolean(apiKey && value));
              }}
            />
          ) : null}
        </>
      )}
      {!isLocked ? (
        <>
          <SecretRow
            label={t("assistant.apiKey")}
            hint={
              provider === "oai-compat" ? t("assistant.keyOptional") : undefined
            }
            value={apiKey}
            onCommit={(value) => {
              setApiKey(value);
              changed(
                Boolean(value) &&
                  (provider !== "oai-compat" || Boolean(baseUrl)),
              );
            }}
          />
          {keyLink ? (
            <ExternalLink
              href={keyLink}
              text={t("assistant.getKey", {
                provider: PROVIDER_NAMES[provider],
              })}
            />
          ) : null}
        </>
      ) : null}
      <ConnectionCheck check={check} isConfigured={isConfigured} />
      {check.state.status === "idle" && isVerified ? (
        <Text variant="small" tone="success">
          {t("assistant.verified")}
        </Text>
      ) : null}
    </Section>
  );
}

const TRIGGERS = ["meal", "recipe", "yesterday"] as const;

/** What Smart Log understands in the food diary */
function TriggerWords() {
  const { t } = useTranslation("settings");
  return (
    <Stack gap={1}>
      <Text variant="label">{t("assistant.triggers.title")}</Text>
      {TRIGGERS.map((trigger) => (
        <Text key={trigger} variant="small" tone="muted">
          {t(`assistant.triggers.${trigger}`)}
        </Text>
      ))}
      <ExternalLink
        href="https://github.com/traceapps/nutritrace#smart-log--voice--ai-food-logging"
        text={t("assistant.triggers.readme")}
      />
    </Stack>
  );
}

export function AssistantPage() {
  const { t, i18n } = useTranslation("settings");
  const locks = useEnvLocks("nt");
  const cookLocks = useEnvLocks("ct").data;
  const isLocked = Boolean(locks.data?.ai);
  // Only CookTrace says which provider and model its environment fixes.
  const cookFixes = cookLocks?.ai
    ? [cookLocks.ai_provider, cookLocks.ai_model].filter(Boolean).join(", ")
    : "";
  const [isOn] = useShared<boolean>(...everywhere("aiEnabled"));
  const [name, setName] = useShared<string>(...everywhere("aiAssistantName"));
  const [voice, setVoice] = useShared<string>(
    ...everywhere("smartLogVoiceLang"),
  );
  const [isSmartLog] = useShared<boolean>(["nt", "quickLogEnabled"]);
  const [hasActivity] = useShared<boolean>(["nt", "diaryShowActivity"]);
  const isEffective = isOn || Boolean(isLocked && locks.data?.ai_enabled);
  const languages = new Intl.DisplayNames([i18n.language], {
    type: "language",
  });

  return (
    <SettingsScreen
      title={t("topics.assistant.title")}
      description={t("assistant.description")}
      backends={["nt", "ct", "lt"]}
    >
      {isLocked ? <Banner text={t("assistant.envLocked")} /> : null}
      {cookLocks?.ai ? (
        <Banner text={t("assistant.cookLocked", { setup: cookFixes || "-" })} />
      ) : null}
      <Section>
        <BoundSwitch
          refs={everywhere("aiEnabled")}
          label={t("assistant.enabled")}
          isDisabled={isLocked}
        />
      </Section>
      {isEffective ? (
        <>
          <Provider
            isLocked={isLocked}
            lockedProvider={
              locks.data?.ai_provider ??
              (isLocked ? cookLocks?.ai_provider : undefined)
            }
            lockedModel={
              locks.data?.ai_model ??
              (isLocked ? cookLocks?.ai_model : undefined)
            }
          />
          <Section title={t("assistant.behaviour")}>
            <TextRow
              label={t("assistant.name")}
              placeholder="Trace"
              value={name}
              onCommit={setName}
            />
            <BoundSwitch
              refs={[
                ["nt", "quickLogEnabled"],
                ["lt", "quickLogEnabled"],
                ["ct", "smartLogEnabled"],
              ]}
              label={t("assistant.smartLog")}
              hint={t("assistant.smartLogHint")}
            />
            {isSmartLog ? <TriggerWords /> : null}
            {isSmartLog ? (
              <SelectRow<string>
                label={t("assistant.voiceLanguage")}
                value={voice || "auto"}
                options={[
                  { value: "auto", label: t("assistant.voiceAuto") },
                  ...VOICE_LANGUAGES.map((value) => ({
                    value,
                    label: languages.of(value) ?? value,
                  })),
                ]}
                onChange={setVoice}
              />
            ) : null}
            <BoundSwitch
              refs={[["nt", "aiGoalInsights"]]}
              label={t("assistant.goalInsights")}
              hint={t("assistant.goalInsightsHint")}
            />
            {hasActivity ? (
              <BoundSwitch
                refs={[["nt", "activityAutoEstimate"]]}
                label={t("assistant.activityEstimate")}
              />
            ) : null}
          </Section>
        </>
      ) : null}
    </SettingsScreen>
  );
}
