# Agent guidelines: trace

Rules for every coding agent (and human) in this repo, each with its reason.

Maintainer notes (private): `~/code/lukasdiegelmann/trace-notes/`, read them if present.

## The rules broken most often

1. **All UI comes from `@monocircuit/monolithium/components`.** Layout `div`s
   are fine; controls and visual building blocks (buttons, inputs, selects,
   dialogs, sheets, chips, charts) are not built inline in `apps/web`. A
   missing component or prop is **added to monolithium** (no need to ask),
   through that library's own workflow, not rebuilt here. *Why:* one place
   decides how things look and behave.
2. **Content props take strings, not `<Text>`** (`title`, `label`, `value`,
   `hint`, `description`, `text`, `placeholder`). *Why:* the component picks
   tone and spacing; see monolithium's README.
3. **The backends stay upstream-shaped.** `backends/*` are forks of
   TraceApps' apps. Change them only when the frontend cannot work otherwise,
   keep each change small and upstreamable, and note it in
   `docs/backend-patches.md`. *Why:* `git merge upstream/main` must stay easy.
   Business logic that lives in the old Svelte UIs is ported into
   `apps/web`, not into the backends.

## Map

| Path | What it is |
| ---- | ---------- |
| `apps/web` | The Trace frontend: React 19 + Vite PWA, Tailwind v4, monolithium. Its conventions: `apps/web/AGENTS.md` |
| `backends/{nutritrace,cooktrace,lifttrace}` | Submodules, forks `lukasdiegelmann/*` of `TraceApps/*` (remote `upstream`). Their `src/` is the old Svelte UI: the reference for what to port |
| `deploy/` | Docker Compose and scripts: nt/ct/lt backends and web, sign-in through an OIDC provider. `SSO.md` is the login contract for the frontend |

## Tooling

- **pnpm only.** One lockfile, `pnpm-lock.yaml`, changed only through pnpm.
- Monolithium is a component library from a private npm registry, pinned to a
  fixed version (scope `@monocircuit`); `.npmrc` reads the registry URL and
  the token from env vars (`MONOCIRCUIT_NPM_REGISTRY`,
  `MONOCIRCUIT_NPM_TOKEN`), never a committed token.
- Formatting is Prettier through ESLint (`eslint --fix`); don't hand-format.
- Booleans start with `is`/`has`/`should`/`can`/`did`/`will`; `interface`
  over `type`.
- i18n from the start: every user-facing string goes through the i18n layer
  (German and English at least).

## Workflow

- One T3 Code thread per task, in its own git worktree
  (`git worktree add ../trace-<n>-<feature> -b <n>-<feature>`), tied to a
  GitHub issue in `lukasdiegelmann/trace` (`gh issue`).
- Before every push: lint, typecheck, tests, build of `apps/web`. Never
  `--no-verify`, never force-push `main`.
- PRs on GitHub (`gh pr create`); with every box of the issue ticked and checks
  green, the agent may merge its own PR.
- Work on monolithium happens in its own repository under its rules, in a
  separate thread (see the maintainer notes).
- **Agents never tag, never create releases, never publish packages**
  (monolithium included). They prepare the version bump and hand the commands
  to the user.
- Decisions are asked with the `AskUserQuestion` dialog, not in chat text.

## Secrets

Never commit or post credentials, tokens or connection strings. Secrets live
on the deploy host in `secrets/*.env` (mode 600, outside the repo) or in
local env vars.
