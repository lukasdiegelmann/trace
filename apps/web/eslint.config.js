import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // Booleans start with is/has/should/can/did/will (AGENTS.md)
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: ["variable", "parameter", "typeProperty"],
          types: ["boolean"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          prefix: ["is", "has", "should", "can", "did", "will", "IS_", "HAS_"],
          filter: { regex: "^(_|aria-)", match: false },
        },
      ],
      // Rule 1 of AGENTS.md: controls come from monolithium
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|input|select|textarea|dialog)$/]",
          message:
            "Controls come from @monocircuit/monolithium/components (AGENTS.md rule 1).",
        },
      ],
    },
  },
  {
    // Declarations of other tools' shapes (Vite's env) keep their names.
    files: ["**/*.d.ts"],
    rules: { "@typescript-eslint/naming-convention": "off" },
  },
  {
    files: ["**/*.mjs", "eslint.config.js", "vite.config.ts", "scripts/**"],
    languageOptions: { globals: { ...globals.node } },
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
