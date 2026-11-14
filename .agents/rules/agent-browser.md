# agent-browser — Visual Verification

The dev server exposes Chrome DevTools Protocol on port 9222 by default (configurable via `CDP_PORT` env var). Use `agent-browser` to inspect and interact with the running Electron app.

## When to Use

- **After UI changes**: connect, snapshot, and screenshot to verify the change renders correctly before committing.
- **For PR screenshots**: capture component states directly rather than asking the user for media.
- **When debugging visual issues**: snapshot the accessibility tree, inspect element styles, check console/errors.
- **For video demos**: use the demo recorder (`scripts/record-demo.mjs`, below). It records at 60fps with an animated cursor and captions. `agent-browser record` is fine for a quick debugging capture, not for PR videos.

## Workflow

```bash
agent-browser connect 9222          # connect to running app
agent-browser tab list              # find the right window
agent-browser snapshot -i           # get element refs
agent-browser screenshot /tmp/x.png # capture state
```

Always re-snapshot after interactions — element refs change when the DOM updates.

## Demo videos

For motion or interaction that a still image cannot show clearly, record a scripted walkthrough with the demo recorder. It drives the app with Playwright over CDP, draws a cursor that glides between targets (with a ripple on each click) plus captions, and records the library window at 60fps with `getDisplayMedia`. The output is an H.264 MP4 ready to upload.

```bash
# 1. Start the dev app with the recorder hook (dev builds only; packaged builds ignore it)
GAMELORD_DEMO_RECORDER=1 CDP_PORT=9223 pnpm --filter @gamelord/desktop dev

# 2. Record a scenario
node scripts/record-demo.mjs library-tour /tmp/library-tour.mp4 --cdp-port 9223
```

Scenarios live in `scripts/demo-scenarios/`. Each is a small module that exports a `steps` array (`caption`, `glide`, `click`, `type`, `press`, `wait`) and, optionally, a `setup(page)` that runs before recording starts. To show a change, copy `library-tour.mjs`, point the steps at the UI you changed, and pass the file's path as the scenario. Scenarios should leave the library as they found it, for example by toggling a favorite twice. The header of `scripts/record-demo.mjs` documents the options and step syntax. The first run downloads the ffmpeg binary.

The recorder captures only the library window. It doesn't capture the game window or audio.

Generated screenshots and recordings are verification evidence, not repository source files. Keep them outside the worktree (for example, under `/tmp`), upload them externally, and embed their URLs in the PR's `Screenshots / Video` section. Never commit generated media to the branch.

## Port Conflict

If port 9222 is in use (e.g. another app instance or Chrome debugging), set `CDP_PORT` to use a different port:

```bash
CDP_PORT=9223 pnpm dev
agent-browser connect 9223
```

Each worktree can use its own port to avoid collisions.
