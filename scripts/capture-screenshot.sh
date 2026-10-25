#!/bin/bash
# Capture a screenshot of the running Electron app via CDP.
#
# Usage: ./scripts/capture-screenshot.sh [output-path] [--cdp-port PORT]
#   output-path  Where to save the screenshot (default: /tmp/gamelord-screenshot.jpg)
#   --cdp-port   CDP debugging port (default: CDP_PORT env var, or 9222)
#
# Prerequisites:
#   - The Electron app must be running with CDP enabled:
#       cd apps/desktop && pnpm dev
#   - playwright must be installed (it's a dev dependency of packages/ui;
#     resolved from there, so the script works from any directory)
#
# Output: saves a JPEG screenshot (quality 80) and prints the path to stdout.
# JPEG keeps file size under GitHub's camo proxy limit (~5MB).

set -euo pipefail

OUTPUT_PATH="/tmp/gamelord-screenshot.jpg"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CDP_PORT="${CDP_PORT:-9222}"

while [ $# -gt 0 ]; do
  case "$1" in
    --cdp-port)
      CDP_PORT="$2"
      shift 2
      ;;
    *)
      OUTPUT_PATH="$1"
      shift
      ;;
  esac
done

# Verify CDP is reachable
if ! curl -s "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
  echo "Error: no CDP endpoint on port ${CDP_PORT}." >&2
  echo "Start the app with: cd apps/desktop && pnpm exec electron-vite dev -- --remote-debugging-port=${CDP_PORT}" >&2
  exit 1
fi

# Use playwright to connect and screenshot.
# Playwright supports JPEG output natively when the path ends in .jpg/.jpeg.
# playwright is only installed in packages/ui (not hoisted to the root), so
# resolve it from there rather than from the current directory. Values are
# passed via env vars so paths containing quotes can't break the script.
PLAYWRIGHT_FROM="${REPO_ROOT}/packages/ui" CDP_PORT="$CDP_PORT" OUTPUT_PATH="$OUTPUT_PATH" node -e "
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_FROM] }));

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + process.env.CDP_PORT);
  const pages = browser.contexts().flatMap(c => c.pages());

  // Prefer the library window (index.html / port 5173), fall back to first page
  const page = pages.find(p => p.url().includes('index.html') || p.url().includes('5173')) || pages[0];

  if (!page) {
    console.error('Error: no pages found via CDP');
    process.exit(1);
  }

  const outPath = process.env.OUTPUT_PATH;
  const isJpeg = outPath.endsWith('.jpg') || outPath.endsWith('.jpeg');

  await page.screenshot({
    path: outPath,
    type: isJpeg ? 'jpeg' : 'png',
    quality: isJpeg ? 80 : undefined,
  });
  console.log(outPath);
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1
