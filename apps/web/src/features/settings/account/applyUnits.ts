import { writeRef } from "../common/binding";
import { unitsFor, type UnitSystem } from "../lib/onboarding";

/** One unit choice, written to every app in its own form */
export function applyUnits(system: UnitSystem): void {
  const units = unitsFor(system, navigator.language);
  writeRef(["nt", "weightUnit"], units.weightUnit);
  writeRef(["lt", "weightUnit"], units.liftWeightUnit);
  writeRef(["nt", "heightUnit"], units.heightUnit);
  writeRef(["lt", "heightUnit"], units.heightUnit);
  writeRef(["nt", "lengthUnit"], units.lengthUnit);
  writeRef(["nt", "distUnit"], units.distUnit);
  writeRef(["nt", "tempUnit"], units.tempUnit);
  writeRef(["nt", "waterUnit"], units.waterUnit);
  writeRef(["nt", "energyUnit"], units.energyUnit);
  writeRef(["ct", "energyUnit"], units.energyUnit);
  writeRef(["ct", "measurementSystem"], units.measurementSystem);
}
