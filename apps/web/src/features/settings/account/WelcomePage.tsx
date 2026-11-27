import {
  Button,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";
import { readStartPage } from "@/features/shared/startPage";

import { useAdminBackends } from "../common/admin";
import { flushSettings } from "../common/binding";
import { SwitchRow } from "../common/fields";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import {
  ACTIVITIES,
  ageOn,
  calorieGoal,
  dailyTargets,
  readGender,
} from "../lib/body";
import {
  liftProfile,
  SETUP_COMPLETE_KEY,
  setupBody,
  type UnitSystem,
} from "../lib/onboarding";
import { LibraryStep } from "./WizardLibrary";
import {
  BodyStep,
  CookingStep,
  LookStep,
  ServicesStep,
  SummaryRows,
  TrainingStep,
  UnitsStep,
} from "./WizardSteps";

const STEPS = [
  "welcome",
  "units",
  "body",
  "training",
  "library",
  "cooking",
  "services",
  "updates",
  "summary",
] as const;

/** How long the "All set" screen stays, as in the old assistants */
export const DONE_DELAY_MS = 1800;

function valuesOf(backend: "nt" | "lt"): Record<string, unknown> {
  return settingsStores[backend].getSnapshot().values as unknown as Record<
    string,
    unknown
  >;
}

function bodyNow() {
  return setupBody(valuesOf("nt"), valuesOf("lt"));
}

/** Targets from what the settings hold now; null while the body is unknown */
function targetsNow() {
  const values = valuesOf("nt");
  const body = bodyNow();
  const { weightKg, heightCm, birthday } = body;
  const activity = ACTIVITIES.find((a) => a === body.activity);
  if (!weightKg || !heightCm || !activity || !birthday) return null;
  return {
    values,
    ...dailyTargets(
      {
        gender: readGender(body.gender),
        age: ageOn(birthday),
        heightCm,
        weightKg,
        activity,
      },
      body.targetKg || weightKg,
    ),
  };
}

/** LiftTrace's profile also keeps birthday and gender */
async function saveLiftProfile(): Promise<void> {
  const profile = liftProfile(bodyNow());
  if (profile) await api.lt.put("/auth/profile", profile);
}

async function markComplete(): Promise<void> {
  await api.nt.put("/settings", { key: SETUP_COMPLETE_KEY, value: true });
  await settingsStores.nt.reload();
}

export function WelcomePage() {
  const { t, i18n } = useTranslation("settings");
  const navigate = useNavigate();
  const admin = useAdminBackends();
  const [index, setIndex] = useState(0);
  const [system, setSystem] = useState<UnitSystem | "">("");
  /** Null until answered here: a rerun keeps what the server has */
  const [shouldCheckChoice, setShouldCheckChoice] = useState<boolean | null>(
    null,
  );
  const firstAdmin = admin.at(0);
  const updateConfig = useLoad(
    async () =>
      firstAdmin
        ? api[firstAdmin].get<{ enabled?: unknown }>("/updates/config")
        : null,
    [firstAdmin],
  );
  const isCheckingUpdates =
    shouldCheckChoice ?? updateConfig.data?.enabled === true;
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const [isDone, setIsDone] = useState(false);
  const step = STEPS[index] ?? "welcome";
  const targets = step === "summary" ? targetsNow() : null;
  const number = new Intl.NumberFormat(i18n.language);

  const leave = useCallback(() => {
    void navigate(readStartPage(), { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(leave, DONE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isDone, leave]);

  const skip = async () => {
    const isConfirmed = await confirm({
      title: t("wizard.skipTitle"),
      message: t("wizard.skipText"),
      confirmText: t("wizard.skip"),
    });
    if (!isConfirmed) return;
    const isSaved = await run(async () => {
      await flushSettings("nt", "ct", "lt");
      await saveLiftProfile();
      await markComplete();
    });
    if (isSaved) leave();
  };

  const finish = () =>
    run(async () => {
      await flushSettings("nt", "ct", "lt");
      if (targets) {
        const goals = (targets.values.goals ?? {}) as Record<string, unknown>;
        await settingsStores.nt.setMany({
          goals: { ...goals, calories: calorieGoal(targets.calories) },
          waterGoalMl: targets.waterMl,
          tdee: targets.tdee,
        });
      }
      await saveLiftProfile();
      await Promise.all(
        admin.map((backend) =>
          api[backend].put("/updates/config", {
            enabled: isCheckingUpdates,
          }),
        ),
      ).catch(() => {
        // Locked by the server's environment: its setting stands.
      });
      await markComplete();
      setIsDone(true);
    });

  const next = () => {
    if (step === "summary") void finish();
    else setIndex((old) => old + 1);
  };

  if (isDone) {
    return (
      <Stack gap={3} padding={6} maxWidth="md" role="status">
        <Text variant="title" as="h1">
          {t("wizard.doneTitle")}
        </Text>
        <Text tone="muted">{t("wizard.doneText")}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap={5} padding={6} maxWidth="md">
      <ProgressBar
        value={(index + 1) / STEPS.length}
        label={t("wizard.progress", {
          step: index + 1,
          total: STEPS.length,
        })}
      />
      <Text variant="title" as="h1">
        {t(`wizard.steps.${step}.title`)}
      </Text>
      <Text tone="muted">{t(`wizard.steps.${step}.text`)}</Text>
      {step === "welcome" ? <LookStep /> : null}
      {step === "units" ? (
        <UnitsStep system={system} onChange={setSystem} />
      ) : null}
      {step === "body" ? <BodyStep /> : null}
      {step === "training" ? <TrainingStep /> : null}
      {step === "library" ? <LibraryStep /> : null}
      {step === "cooking" ? <CookingStep /> : null}
      {step === "services" ? <ServicesStep /> : null}
      {step === "updates" ? (
        <SwitchRow
          label={t("wizard.updates")}
          isChecked={isCheckingUpdates}
          isDisabled={admin.length === 0}
          onChange={setShouldCheckChoice}
        />
      ) : null}
      {step === "summary" ? (
        targets ? (
          <SummaryRows
            rows={[
              [t("wizard.tdee"), `${number.format(targets.tdee)} kcal`],
              [
                t("wizard.calorieGoal"),
                `${number.format(targets.calories)} kcal`,
              ],
              [t("wizard.waterGoal"), `${number.format(targets.waterMl)} ml`],
            ]}
          />
        ) : (
          <Text>{t("wizard.noTargets")}</Text>
        )
      ) : null}
      <Row gap={2} shouldWrap>
        {index > 0 ? (
          <Button
            variant="secondary"
            size="md"
            text={t("wizard.back")}
            onClick={() => {
              setIndex((old) => old - 1);
            }}
          />
        ) : null}
        <Button
          variant="primary"
          size="md"
          text={t(
            step === "summary"
              ? "wizard.finish"
              : step === "welcome"
                ? "wizard.start"
                : "actions.next",
          )}
          isLoading={isBusy}
          onClick={next}
        />
        {step !== "summary" ? (
          <Button
            variant="ghost"
            size="md"
            text={t(step === "welcome" ? "wizard.later" : "wizard.skip")}
            onClick={() => void skip()}
          />
        ) : null}
      </Row>
      {dialog}
    </Stack>
  );
}
