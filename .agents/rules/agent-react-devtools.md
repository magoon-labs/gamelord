# agent-react-devtools — React Component Inspection

A dev-only Vite plugin in `apps/desktop/electron.vite.config.ts` probes the daemon's port (8097) each time the library window's `index.html` is served. If the daemon is listening, the plugin injects `agent-react-devtools/connect` at the top of `<head>`, so the DevTools hook installs before the app's entry module loads React. This gives CLI access to the full React component tree, props, state, hooks, and performance profiling. With no daemon, the module isn't loaded and nothing is logged. The game window never loads it.

## When to Use

- **Debugging state issues**: inspect a component's hooks and props directly instead of adding `console.log`.
- **Performance profiling**: profile renders to find slow or over-rendering components (complements the frame-rate-is-sacred policy).
- **After refactors**: verify component tree structure hasn't changed unexpectedly.
- **Error tracking**: check `errors` to find components with React errors without scanning console logs.

## Workflow

```bash
# 1. Start the daemon
npx agent-react-devtools start

# 2. Start the app (it connects automatically), or reload the library window if the app is already running
pnpm --filter @gamelord/desktop dev

# 3. Verify connection
npx agent-react-devtools status    # should show "1 connected, N components"

# 4. Inspect
npx agent-react-devtools get tree --depth 3        # component hierarchy
npx agent-react-devtools find GameLibrary           # find by name
npx agent-react-devtools get component @c34         # inspect props/state/hooks
npx agent-react-devtools errors                     # components with errors
npx agent-react-devtools count                      # component breakdown

# 5. Profile
npx agent-react-devtools profile start
# ... interact with the app ...
npx agent-react-devtools profile stop
npx agent-react-devtools profile slow               # slowest components
npx agent-react-devtools profile rerenders           # most re-rendered
```

## Important

- **The daemon must be running when the page loads.** The port is checked on each load of `index.html`. If you start the daemon while the app is running, reload the library window to connect.
- **Element refs (`@cN`) change after re-renders.** Always re-run `find` or `get tree` to get fresh refs before `get component`.
- **No production overhead.** The plugin only runs on the dev server, so production builds contain no connect code.
- **No frame pacing impact.** The DevTools hook is passive — it observes the fiber tree without interfering with rendering. Only active when the daemon is connected.
