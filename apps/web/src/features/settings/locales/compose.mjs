// Writes locales/{de,en}.ts: one `settings` namespace out of the per-area
// files in locales/{de,en}/. Run after adding an area file.
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

for (const language of ["de", "en"]) {
  const dir = fileURLToPath(new URL(`./${language}/`, import.meta.url));
  const areas = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();
  writeFileSync(
    fileURLToPath(new URL(`./${language}.ts`, import.meta.url)),
    [
      "// Written by compose.mjs from the files in this language's folder.",
      ...areas.map(
        (area) => `import ${area} from "./${language}/${area}.json";`,
      ),
      "",
      "export default {",
      ...areas.map((area) => `  ...${area},`),
      "};",
      "",
    ].join("\n"),
  );
}
