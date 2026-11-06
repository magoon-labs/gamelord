# GameLord

## Session Start

At the start of every new conversation, before doing anything else:

1. **Sync with latest main:**
   - **Normal repo:** `git fetch origin && git checkout main && git pull origin main`
   - **Worktree** (detected by path containing `.claude/worktrees/`): `git fetch origin && git rebase origin/main` — you cannot checkout main in a worktree because it's already checked out by the main repo.
2. If there are stashed or uncommitted changes from a previous session, surface them to the user and ask what to do (keep, drop, or stash).
3. Read `ARCHITECTURE.md` for project context. Check GitHub Issues for current work items.

Never give advice about what to work on next, or start new work, from a stale branch.

## Key Documentation

- `ARCHITECTURE.md` — How the app works, key files, supported cores.
- **GitHub Issues** — Source of truth for project state. Use parent issues with sub-issues for multi-part work. Close issues via PRs (`Closes #123`). Create new issues when discovering work.

## Agent skills

This repo uses the engineering skills from [mattpocock/skills](https://github.com/mattpocock/skills) (installed under `.claude/skills/`). The skills read the docs below to know how this repo operates.

### Issue tracker

GitHub Issues at [magoon-labs/gamelord](https://github.com/magoon-labs/gamelord). See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Canonical 5-state vocabulary, names match the defaults. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context. `CONTEXT.md` + `docs/adr/` live at the repo root if/when they're created (lazily by `/grill-with-docs`). See [docs/agents/domain.md](docs/agents/domain.md).

## Detailed Rules

Detailed rules live in `.agents/rules/`. `.claude/rules` is a symlink to it, so Claude Code and Grok load them automatically. Other agents must read the relevant file before working in that area. Always edit the files in `.agents/rules/`.

- `agent-browser.md`: visually verifying the running app
- `agent-react-devtools.md`: inspecting React components
- `dependencies.md`: adding or updating dependencies
- `design-philosophy.md`, `visual-checkpoints.md`, `shadcn-components.md`, `inspiration-language.md`: UI work and how to describe it
- `storybook.md`: stories for component states
- `performance.md`: anything touching the game window or emulation loop
- `session-start.md`: native addon and worktree setup
- `issue-first.md`, `github-issues.md`, `good-first-issues.md`, `development-plan.md`: creating and tracking issues
- `pull-requests.md`, `screenshot-hosting.md`: PR media and review comments

## Package Manager

This project uses **pnpm**. Always use `pnpm` for installing dependencies, running scripts, etc. — never `npm` or `yarn`.

## Git Conventions

- **Never push directly to `main`.** Branch protection with required status checks is enabled. Always create a feature branch and open a PR, even for trivial changes.
- Use descriptive branch names: `<type>/<short-descriptive-name>`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- Examples: `feat/game-library-search`, `fix/storybook-tailwind`, `refactor/emulator-manager`

## Pull Requests

- **Reference the GitHub issue.** If a PR implements a feature or fixes a bug that has an existing GitHub issue, the PR description must include `Closes #<number>` (or `Fixes #<number>` for bugs). This auto-closes the issue on merge and makes the history traceable. If no issue exists and the work is non-trivial, create one first.

## Merging

- `main` uses a merge queue. Merge a green PR with `gh pr merge <N>` (no strategy flag; the queue squashes). PRs can enter the queue while BEHIND, so don't update branches first.
- If required check names changed, a green PR can sit BEHIND and never queue, and re-runs won't help. Merge `origin/main` into the branch so CI uses the new workflow. To diagnose, compare `gh pr checks N` with `gh api repos/magoon-labs/gamelord/rules/branches/main`.
- Agents may merge low-risk PRs without asking: required checks green, no unresolved review comments, and either our own non-visual change that meets its acceptance criteria, a verified Dependabot batch (majors smoke-tested in the dev app), or a small, clearly correct fix.
- Ask first for visual/UI changes, external contributor PRs, CI/release/workflow/secrets changes, architecture or product decisions, feature removals, and emulation loop, native addon, shader or frame-pacing work.

## Parallel Sessions

Several agents often work here at once, including a daily maintenance thread that owns the Dependabot backlog and PR merges. Before work not scoped to a single issue (dependency bumps, merges, repo settings, CI), check active threads and search open PRs and issues for the same work. If another agent owns the area, hand off instead of proceeding.

## Vercel CI

Vercel CI doesn't run on public repos, and `vercel ci enable` still succeeds. If a setup produces no runs, call `vercel api "/v1/vercel-ci/task-analyses?teamId=<team>" --method POST` with `{"owner","repo"}`, which returns the real reason. Parked in #554.

## Design Philosophy

- **Extremely polished UI.** Every interaction should feel intentional and delightful. Prioritize craft and attention to detail — this is a desktop app, not a throwaway prototype.
- **Microinteractions and animations.** Use tasteful transitions, hover effects, loading states, and motion to make the app feel alive. Think about easing curves, staggered animations, and subtle feedback on every click, toggle, and navigation.
- **Ideate novel flourishes.** When implementing a feature, proactively suggest creative UI touches — e.g. a CRT power-on animation when launching a game, particle effects on achievements, satisfying haptic-style feedback on button presses, ambient glow effects. Propose these ideas to the user before implementing.

## Storybook Coverage

All UI components with loading, error, or transitional states **must** have Storybook stories representing each state. This makes states easy to polish, iterate on, and visually verify without needing to reproduce them in the running app. Examples: artwork sync phases (hashing, querying, downloading, done, error, not-found), empty/loading library, form validation errors.

## Performance — Frame Rate is Sacred

Emulation frame pacing is a top-tier concern. Every code change — especially in the renderer, game window, and emulation loop — must be evaluated for its impact on consistent frame delivery. The app must look and feel smooth on 120Hz+ displays.

### Rules

- **No `backdrop-filter` or `backdrop-blur` in the game window.** These force expensive GPU compositing every frame and compete with the WebGL shader pipeline. Use solid or semi-transparent backgrounds instead. Backdrop effects are fine in the library UI where frame pacing doesn't matter.
- **No expensive CSS effects layered over the game canvas.** Avoid `box-shadow` animations, large `filter: blur()`, or CSS `transform` animations on elements that overlap the canvas during gameplay. Static transforms and opacity transitions are acceptable.
- **Renderer draws must be synced to `requestAnimationFrame`.** Never draw to WebGL directly from an IPC event handler. Buffer the latest frame and draw it in the next rAF callback to align with the display's vsync.
- **Emulation timing must not rely on `setTimeout`/`setInterval` precision.** These have ~4ms minimum granularity and jitter under load. The emulation loop runs in a dedicated Electron utility process (`core-worker.ts`) with hybrid sleep+spin frame pacing.
- **Profile before adding multi-pass shaders.** Any shader preset with 3+ passes must be tested on integrated GPUs (e.g. Apple M-series) to confirm it maintains 60fps. Include lighter alternatives users can fall back to.
- **Measure, don't guess.** When in doubt about a change's performance impact, add a temporary FPS/frame-time counter and test with a real game running. Don't ship code that "should be fine" without verification.
- **Pause-state effects are exempt.** When the emulation loop is stopped (paused, menu open, etc.), the GPU is idle and expensive cosmetic effects (VHS distortion, scanline drift, static overlays) are fair game. The performance rules above apply to effects running _during active gameplay_.

## Responsiveness — Never Block the UI

The renderer process must stay responsive at all times. Long-running operations (file I/O, hashing, network requests, database queries, bulk processing) must never freeze the UI or make the user wait with no feedback.

### Rules

- **Never await a long operation without streaming progress.** If an IPC invoke could take more than ~200ms (scanning directories, hashing files, downloading assets, bulk sync), the main process must emit incremental progress events so the renderer can show live feedback (counts, progress bars, items appearing as they're found).
- **Process new/unknown items first.** When rescanning or re-syncing, prioritize items the user hasn't seen before. Known/cached items can be verified in the background after new items are already visible.
- **Cache aggressively, invalidate precisely.** Store enough metadata (file mtimes, content hashes, ETags) to skip redundant work on repeat operations. A rescan of unchanged data should be near-instant.
- **Bound concurrency, don't serialize.** When processing many independent items (hashing files, downloading images, querying APIs), use bounded parallel execution (e.g. `Promise.all` over batches of 4-8) instead of sequential `for...of` loops.
- **Show the result before the operation finishes.** If a scan finds 5 new games, those 5 should appear in the library grid immediately — don't wait for the remaining 2000 known files to be re-verified before updating the UI.
- **Maintain a reverse index for O(1) lookups.** When a data structure is frequently queried by a secondary key (e.g. looking up games by `romPath` during scans), maintain an index map instead of doing linear scans over the full collection.
