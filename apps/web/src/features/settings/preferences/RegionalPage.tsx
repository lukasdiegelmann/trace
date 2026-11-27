import { Button, KeyValue, Row } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useShared } from "../common/binding";
import { SegmentRow, SelectRow, type Option } from "../common/fields";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { deviceTimezone, liftDateFormat, liftWeightUnit } from "../lib/units";

function plain(...values: string[]): Option[] {
  return values.map((value) => ({ value, label: value }));
}

export function RegionalPage() {
  const { t } = useTranslation("settings");
  const [dateFormat, setDateFormat] = useShared<string>(
    ["nt", "dateFormat"],
    ["ct", "dateFormat"],
    ["lt", "dateFormat", liftDateFormat],
  );
  const [timeFormat, setTimeFormat] = useShared<string>(
    ["nt", "timeFormat"],
    ["ct", "timeFormat"],
    ["lt", "timeFormat"],
  );
  const [timezone, setTimezone] = useShared<string>(
    ["nt", "timezone"],
    ["ct", "timezone"],
  );
  const [energy, setEnergy] = useShared<string>(
    ["nt", "energyUnit"],
    ["ct", "energyUnit"],
  );
  const [weight, setWeight] = useShared<string>(["nt", "weightUnit"]);
  const [, setLiftWeight] = useShared<string>([
    "lt",
    "weightUnit",
    liftWeightUnit,
  ]);
  const [height, setHeight] = useShared<string>(
    ["nt", "heightUnit"],
    ["lt", "heightUnit"],
  );
  const [length, setLength] = useShared<string>(["nt", "lengthUnit"]);
  const [distance, setDistance] = useShared<string>(["nt", "distUnit"]);
  const [temperature, setTemperature] = useShared<string>(["nt", "tempUnit"]);
  const [system, setSystem] = useShared<string>(["ct", "measurementSystem"]);
  const detected = deviceTimezone();

  return (
    <SettingsScreen
      title={t("topics.regional.title")}
      description={t("regional.description")}
      backends={["nt", "ct", "lt"]}
    >
      <Section title={t("regional.formats")}>
        <SelectRow
          label={t("regional.dateFormat")}
          hint={t("regional.dateFormatHint")}
          value={dateFormat}
          options={[
            { value: "ISO", label: t("regional.dates.ISO") },
            { value: "US", label: t("regional.dates.US") },
            { value: "EU", label: t("regional.dates.EU") },
            { value: "natural", label: t("regional.dates.natural") },
          ]}
          onChange={setDateFormat}
        />
        <SegmentRow
          label={t("regional.timeFormat")}
          value={timeFormat}
          options={[
            { value: "24h", label: t("regional.times.h24") },
            { value: "12h", label: t("regional.times.h12") },
          ]}
          onChange={setTimeFormat}
        />
        <KeyValue
          label={t("regional.timezone")}
          value={timezone || t("regional.timezoneUnset")}
          hint={t("regional.timezoneHint")}
        />
        {detected && detected !== timezone ? (
          <Row>
            <Button
              variant="secondary"
              size="sm"
              text={t("regional.useDeviceTimezone", { zone: detected })}
              onClick={() => {
                setTimezone(detected);
              }}
            />
          </Row>
        ) : null}
      </Section>
      <Section title={t("regional.units")}>
        <SegmentRow
          label={t("regional.energy")}
          value={energy}
          options={plain("kcal", "kJ")}
          onChange={setEnergy}
        />
        <SegmentRow
          label={t("regional.weight")}
          hint={t("regional.weightHint")}
          value={weight}
          options={plain("kg", "lb", "st")}
          onChange={(value) => {
            setWeight(value);
            setLiftWeight(value);
          }}
        />
        <SegmentRow
          label={t("regional.height")}
          value={height}
          options={plain("cm", "ft")}
          onChange={setHeight}
        />
        <SegmentRow
          label={t("regional.circumference")}
          value={length}
          options={plain("cm", "in")}
          onChange={setLength}
        />
        <SegmentRow
          label={t("regional.distance")}
          value={distance}
          options={plain("km", "mi")}
          onChange={setDistance}
        />
        <SegmentRow
          label={t("regional.temperature")}
          value={temperature}
          options={[
            { value: "C", label: "°C" },
            { value: "F", label: "°F" },
          ]}
          onChange={setTemperature}
        />
        <SegmentRow
          label={t("regional.measurementSystem")}
          hint={t("regional.measurementSystemHint")}
          value={system}
          options={[
            { value: "metric", label: t("regional.systems.metric") },
            { value: "imperial", label: t("regional.systems.imperial") },
          ]}
          onChange={setSystem}
        />
      </Section>
    </SettingsScreen>
  );
}
