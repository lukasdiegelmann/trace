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

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.css" {}
