# No Forgejo workflows

CI runs on the GitHub mirror (`.github/workflows`). Forgejo Actions falls back
to `.github/workflows` when this directory is missing and would queue those
jobs here too, so keep it.
