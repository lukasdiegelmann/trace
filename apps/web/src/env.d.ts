/**
 * What the app uses of Vite's client types. Not `vite/client` itself:
 * @monocircuit/utilities declares `ImportMetaEnv.DEV` as readonly, Vite
 * without, and TypeScript rejects the mix (TS2687). TEMPORARY until
 * utilities matches Vite's declaration; then use "vite/client" again.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The commit and version this bundle was built from (vite.config.ts) */
declare const __TRACE_BUILD_COMMIT__: string;
declare const __TRACE_VERSION__: string;

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.css" {}
