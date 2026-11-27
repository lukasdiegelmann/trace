# Agent guidelines: apps/web

The conventions of the Trace frontend, for every feature thread. The repo's
rules (`../../AGENTS.md`) apply first; this file adds what is specific to
`apps/web`. The login contract with the backends is `../../deploy/SSO.md`.

## Commands

```bash
pnpm --filter web dev        # http://localhost:5173, /nt /ct /lt proxied (below)
pnpm --filter web lint       # ESLint + Prettier (lint:fix formats)
pnpm --filter web typecheck
pnpm --filter web test       # Vitest + Testing Library (jsdom)
pnpm --filter web build      # dist/, incl. service worker and manifest
```

All four (lint, typecheck, test, build) pass before every push.

`pnpm dev` proxies `/nt`, `/ct`, `/lt` to `TRACE_BACKEND_ORIGIN`, which has
no default and must be set (e.g. `https://trace.example.com`). The backends'
cookies are `Secure`, so a sign-in only sticks on a deployed origin; locally,
run the backends yourself (`backends/*`, `BASE_URL=/nt` etc.) and point
`TRACE_BACKEND_ORIGIN` at them, or test against mocks.

## Layout

```
src/
  main.tsx            entry: theme, i18n, service worker, providers, router
  router.tsx          the route table; each feature mounts its routes here
  api/                one client per backend (api.nt, api.ct, api.lt), errors
  auth/               the SSO chain (sso.ts), AuthProvider, sign-in and callback pages
  i18n/               i18next setup, the namespace registry, common strings
  theme/              dark mode (system or manual)
  shell/              RootLayout, AppShell (floating navigation pill), navigation, 404
  pwa/                service worker registration
  features/
    nutrition/        NutriTrace's screens   -> /nutrition/*
    cooking/          CookTrace's screens    -> /cooking/*
    training/         LiftTrace's screens    -> /training/*
    settings/         shared settings        -> /settings/*
    shared/           pieces used by more than one feature
  test/               setup and helpers (fakeFetch)
```

A feature folder holds:

```
features/<feature>/
  routes.tsx          export const <feature>Routes: RouteObject[] (relative paths)
  locales/de.json     the feature's i18n namespace, German
  locales/en.json     ... and English
  <Screen>Page.tsx    one file per screen
  api.ts              typed calls of this feature (wrapping api.<backend>)
  lib/                plain logic ported from the Svelte apps (pure, tested)
  *.test.ts(x)        next to what they test
```

A feature imports from `@/api`, `@/auth`, `@/i18n`, `@/features/shared` and
its own folder, never from another feature's folder. What two features need
moves to `features/shared` (or `src/lib` for plain logic).

Routes are history mode (`createBrowserRouter`). A screen's URL is
`/<feature>/<screen>[/:id]`. `/auth/*`, `/nt`, `/ct`, `/lt` and `/__trace`
are taken. Large screens may load lazily (`lazy` in the route object).

## UI: monolithium only

- **Controls and visual building blocks come from
  `@monocircuit/monolithium/components`** (rule 1 of the repo). ESLint fails
  on a raw `<button>`, `<input>`, `<select>`, `<textarea>` or `<dialog>`.
  Layout `div`s with Tailwind classes are fine, but prefer `Stack`, `Row`,
  `Box`, `ScrollArea`.
- **Content props take strings** (`title`, `label`, `text`, `value`, `hint`,
  `description`, `placeholder`), not `<Text>`.
- Icons: `lucide-react`, passed where a component takes an `icon` node.
- Colours, spacing, radii come from monolithium's tokens (`bg-level-1`,
  `text-muted`, `gap-3`, `rounded-container`); no hex values, no custom
  palette. Dark mode is the `dark` class; use `dark:` only where a token
  doesn't already switch.
- Phones: `compact:` (below 48rem) and `pointer-coarse:`; `useIsCompact()`
  only for what CSS can't decide.

**A missing component or prop** is not built here. Write it down as a need:
a comment on the feature's Forgejo issue (what, which screen, the closest
monolithium component), and, if the user agrees, the change goes into
monolithium through its own workflow (in a separate thread, see the
maintainer notes). Until it lands, use the closest existing component and
leave a `// TODO(monolithium): <need>` at the spot.

## Talking to the backends

```ts
import { api, ApiError, SessionExpiredError } from "@/api";

const foods = await api.nt.get<Food[]>("/foods", { query: { q: "apple" } });
await api.ct.post("/recipes", recipe);           // JSON body
await api.lt.put(`/workouts/${id}`, workout);
await api.nt.post("/uploads", formData);         // FormData as is
```

- Paths are relative to `/<backend>/api`; calls stay same-origin.
- nt and ct need `X-CSRF-Token` on POST/PUT/PATCH/DELETE: the client fetches
  it from `/auth/me`, sends it, and on a CSRF 403 fetches it again and
  retries once. lt has no CSRF. Never handle CSRF in a feature.
- A 401 throws `SessionExpiredError` and tells `AuthProvider`, which shows
  the sign-in page; a feature just lets it propagate. Where a backend answers
  401 for something else (nt: a wearable's grant is gone), pass
  `{ shouldVerify401: true }`: the client asks `/auth/me` first and throws a
  plain `ApiError` while the session lives.
- Other non-2xx throw `ApiError` with `status` and the parsed `body`
  (`error.message` is the backend's `error` string when it sends one).
- Keep the backend's JSON shapes in the feature's `api.ts` as `interface`s;
  convert to UI shapes there, not in components.
- Backend behaviour stays upstream-shaped (repo rule 3): business logic of
  the old Svelte UIs (`backends/*/src`) is ported into `lib/` here.
- Settings keys and semantics are defined client-side in the old UIs
  (`src/stores/settings.js`); keep them compatible. Read and write them
  only through `@/features/shared/settings`:
  `const [unit, setUnit] = useSetting("nt", "energyUnit")` (typed key,
  the old default until the backend answers, saved debounced like the old
  stores) or `useSettings("lt")` for all of them; `settingsStores.nt.setMany`
  for several at once. Keys, defaults and which ones sync are generated
  from the old stores (`pnpm --filter web settings:definitions`).

## Strings: i18n

- Every user-facing string goes through i18next (`useTranslation`), German
  and English. No literal text in JSX, `aria-label`s included.
- One namespace per feature: `features/<feature>/locales/{de,en}.json`,
  registered in `src/i18n/resources.ts`. `useTranslation("<feature>")`;
  common strings (`nav`, `backends`, `app`) are the default namespace.
- Keys are camelCase, nested by screen: `diary.title`, `diary.empty`,
  `foodEditor.fields.name`. Interpolation with `{{name}}`; plurals with
  i18next's `_one`/`_other` suffixes.
- English is the type reference: a key missing in `en.json` is a type
  error, a key missing in `de.json` fails `src/i18n/i18n.test.ts`.
- Dates, numbers, units: `Intl` with `i18n.language`.

## Tests

- Vitest + Testing Library, files next to the code (`*.test.ts(x)`).
- Logic ported from the Svelte apps (`lib/`) gets unit tests with the
  original's cases.
- Components: render with a `createMemoryRouter` and, where they need it, an
  `AuthContext` value; assert what the user sees (roles, text), not classes
  or sizes (jsdom has no layout).
- HTTP: `fakeFetch` from `@/test/fakeFetch` (passed to `createApiClient`), or
  `vi.spyOn(api.nt, "get")`; no real network.

## Code

- TypeScript strict, `interface` over `type` for object shapes, booleans
  start with `is`/`has`/`should`/`can`/`did`/`will` (ESLint checks both).
- Imports through `@/` across folders, relative inside a folder.
- Formatting is Prettier through ESLint (`pnpm --filter web lint:fix`).
- Server state: plain `api` calls in effects or route loaders for now; one
  shared pattern per need goes into `features/shared` rather than a new
  library per feature.

## Monolithium during development

Monolithium is a component library from a private npm registry; installing it
needs `MONOCIRCUIT_NPM_REGISTRY` and `MONOCIRCUIT_NPM_TOKEN` (see
`../../.npmrc`). `package.json` pins an exact version of monolithium and
utilities (always the same version for both). To try an unpublished checkout:

```bash
cd apps/web
pnpm link <path to the monolithium package in your checkout>
# afterwards: git checkout package.json pnpm-workspace.yaml pnpm-lock.yaml && pnpm install
```

`pnpm link` writes an `overrides` entry into `pnpm-workspace.yaml` and the
lockfile (run from the repo root, also a dependency into the root
`package.json`); **never commit those**. `monolithium()` in `vite.config.ts` keeps
one React for a linked checkout, and `tsconfig.app.json` pins the React
types for the same reason.
