import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { connect } from "node:net";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import type { Plugin } from "vite";

// Load .env at config time so values are available for build-time injection.
// In CI, these come from GitHub Actions secrets instead.
loadDotenv({ path: resolve(__dirname, ".env") });

function getGitBranch(): string | null {
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

function getWorktreeInfo(): { name: string; path: string } | null {
  const match = process.cwd().match(/^(.*\/\.claude\/worktrees\/([^/]+))/);
  if (!match) {
    return null;
  }
  return { name: match[2], path: match[1] };
}

const isDev = process.env.NODE_ENV !== "production";
const gitBranch = isDev ? getGitBranch() : null;
const worktreeInfo = isDev ? getWorktreeInfo() : null;

/**
 * Returns the Sentry Vite plugin for source map uploads when auth credentials
 * are available (CI release builds). Returns an empty array otherwise so the
 * spread in plugin lists is a no-op during local development.
 */
function sentryPlugins(): Array<Plugin> {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    return [];
  }
  return [
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.npm_package_version },
      sourcemaps: {
        filesToDeleteAfterUpload: ["./out/**/*.map"],
      },
    }),
  ];
}

/** Vite plugin that injects dev-time git info as compile-time constants. */
function devGitInfoPlugin(): Plugin {
  const replacements: Record<string, string> = {
    __DEV_GIT_BRANCH__: JSON.stringify(gitBranch),
    __DEV_WORKTREE_NAME__: JSON.stringify(worktreeInfo?.name ?? null),
    __DEV_WORKTREE_PATH__: JSON.stringify(worktreeInfo?.path ?? null),
  };

  return {
    name: "dev-git-info",
    transform(code, id) {
      if (!id.endsWith(".tsx") && !id.endsWith(".ts")) {
        return;
      }
      let result = code;
      for (const [key, value] of Object.entries(replacements)) {
        result = result.replaceAll(key, value);
      }
      if (result !== code) {
        return { code: result, map: null };
      }
    },
  };
}

/** Resolves whether something accepts TCP connections on the local port. */
function isLocalPortOpen(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "localhost", port, timeout: timeoutMs });
    const settle = (isOpen: boolean) => {
      socket.destroy();
      resolve(isOpen);
    };
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

/**
 * Loads `agent-react-devtools/connect` in the library window only while its
 * daemon is listening. The module always opens a WebSocket, and Chromium logs a
 * failed handshake in a way JS can't suppress, so a plain `pnpm dev` must not
 * load it. The port is probed per request, so a daemon started after the app
 * connects on the next window reload.
 */
function agentReactDevtoolsPlugin(): Plugin {
  const connectModule = "agent-react-devtools/connect";

  return {
    name: "agent-react-devtools-when-listening",
    apply: "serve",
    config() {
      // Vite's dependency scan reads the HTML on disk, so it can't see the
      // injected import. Pre-bundle it to avoid a reload when it first loads.
      return { optimizeDeps: { include: [connectModule] } };
    },
    transformIndexHtml: {
      // Must run before Vite's own HTML transform, which rewrites the bare
      // import in the inline script below.
      order: "pre",
      async handler(_html, ctx) {
        if (ctx.path !== "/index.html" || !(await isLocalPortOpen(8097, 100))) {
          return [];
        }
        return [
          {
            tag: "script",
            attrs: { type: "module" },
            children: `import "${connectModule}";`,
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}

export default defineConfig({
  main: {
    build: {
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : undefined,
      // Bundle runtime deps into `out/`. electron-builder only packages
      // `out/**/*`, and CJS deps like electron-updater can't be named-imported
      // from the ESM main bundle when left external.
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main.ts"),
          "workers/core-worker": resolve(__dirname, "src/main/workers/core-worker.ts"),
          "workers/json-stringify-worker": resolve(
            __dirname,
            "src/main/workers/json-stringify-worker.ts",
          ),
        },
        // `electron` must stay external — it's provided by the runtime. Bundling
        // its npm shim breaks `getElectronPath()` (it reads `path.txt` relative
        // to its own dir). Deps aren't externalized (see `externalizeDeps`),
        // so list it explicitly.
        external: ["electron", /^electron\/.+/, /\.node$/],
        output: {
          format: "es",
        },
      },
    },
    define: {
      // electron-vite + Vite 8 emit the main process as ESM (`.mjs`), where
      // `__dirname`/`__filename` don't exist. Replace them at build time with
      // the ESM equivalents (Node >= 20.11, which Electron 41 ships) so both
      // our code and bundled CJS deps resolve paths correctly. Don't recreate
      // them via an output banner: electron-vite injects its own CommonJS
      // shim into chunks that contain CJS syntax, and a banner declaring the
      // same `const`s collides with it ("Identifier '__filename' has already
      // been declared").
      __dirname: "import.meta.dirname",
      __filename: "import.meta.filename",
      "process.env.SCREENSCRAPER_DEV_ID": JSON.stringify(process.env.SCREENSCRAPER_DEV_ID ?? ""),
      "process.env.SCREENSCRAPER_DEV_PASSWORD": JSON.stringify(
        process.env.SCREENSCRAPER_DEV_PASSWORD ?? "",
      ),
      "process.env.SENTRY_DSN": JSON.stringify(process.env.SENTRY_DSN ?? ""),
    },
    plugins: [...sentryPlugins()],
  },
  preload: {
    build: {
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : undefined,
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload.ts"),
        },
        // Keep `electron` external here too — bundling its shim makes the
        // sandboxed preload throw on load, so `contextBridge` never runs and
        // the renderer never receives `window.gamelord`.
        external: ["electron", /^electron\/.+/, /\.node$/],
        output: {
          // Sandboxed preload scripts must be CommonJS — Electron does not
          // support ESM preloads when `sandbox: true`. Force `.cjs` output so
          // the preload loads and `contextBridge` exposes the renderer API.
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
    plugins: [...sentryPlugins()],
  },
  renderer: {
    build: {
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : undefined,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
          "game-window": resolve(__dirname, "game-window.html"),
        },
      },
    },
    optimizeDeps: {
      exclude: ["@gamelord/ui"],
    },
    plugins: [react(), devGitInfoPlugin(), agentReactDevtoolsPlugin(), ...sentryPlugins()],
    resolve: {
      // Ensure pnpm workspace symlinks (e.g. @gamelord/ui → packages/ui)
      // resolve to their real paths, so Node module resolution walks up from
      // the real package directory to the root node_modules where pnpm
      // installs transitive dependencies.
      preserveSymlinks: false,
    },
    root: ".",
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
  },
});
