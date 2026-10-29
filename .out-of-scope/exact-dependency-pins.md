# Exact dependency pins

GameLord keeps `^` ranges in its `package.json` files instead of pinning every dependency to an exact version.

## Why this is out of scope

`pnpm-lock.yaml` is committed, so every install (CI, a fresh clone, a worktree) already resolves the exact same versions. A `^` range only matters when the lockfile is regenerated, and that only happens on purpose:

- **Dependabot** opens weekly grouped minor/patch PRs (`.github/dependabot.yml`), with Sentry grouped separately so its SDKs move in lockstep (#447).
- Those updates land as **one verified batch** per week: typecheck, lint, format, UI and desktop tests, `electron-vite build`, a native addon rebuild, a single `react`/`react-dom` copy, and a single `@sentry/core`. Major bumps also get a dev-app smoke test (library loads, a game runs).

Exact pins wouldn't make installs more reproducible than the lockfile already does. They would turn every patch release into a manifest edit, and make Dependabot's grouping noisier.

## Exceptions

Pin a single package exactly when its version has to line up with another package's internals. `@sentry/react` is pinned to the `@sentry/core` version that `@sentry/electron` uses (#447). Leave a comment or issue reference next to any such pin.

## Prior requests

- #103 — "Pin dependency versions in package.json" (closed as not planned, 2026-10-29)
