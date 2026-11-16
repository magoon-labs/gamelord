#!/usr/bin/env node
// Record a scripted 60fps demo of the running dev app as an MP4 for PRs.
//
// Usage: node scripts/record-demo.mjs <scenario> <out.mp4> [--cdp-port PORT] [--fps N] [--keep-webm]
//   scenario     A name in scripts/demo-scenarios/ (e.g. library-tour) or a path to a .mjs module.
//   out.mp4      Where to write the H.264 MP4.
//   --cdp-port   CDP port of the dev app (default: CDP_PORT env var, or 9222).
//   --fps        Capture and output frame rate (default: 60).
//   --keep-webm  Also keep the raw WebM next to the MP4.
//
// Prerequisite: the dev app running with the recorder hook enabled:
//   GAMELORD_DEMO_RECORDER=1 CDP_PORT=9222 pnpm --filter @gamelord/desktop dev
//
// How it works: Playwright connects over CDP, injects an overlay (a cursor
// animated on requestAnimationFrame, click ripples, captions) and starts
// getDisplayMedia + MediaRecorder inside the library window. The scenario's
// steps drive the overlay and send real mouse and keyboard input through
// Playwright. The WebM is streamed back over CDP and converted with ffmpeg.
//
// A scenario module exports `steps` (an array) and optionally `setup(page)`,
// which runs before recording starts. Steps:
//   { caption: "Text" }                 show a caption (null hides it)
//   { glide: target, duration? }        move the cursor to a target (real hover)
//   { click: target }                   glide to a target and click it
//   { type: "text", into?: target }     type text, clicking `into` first
//   { press: "Escape" }                 press a key
//   { wait: 800 }                       pause, in ms
// A target is a Playwright selector string or { x, y } in CSS pixels. Add
// `optional: true` to skip a step whose target isn't on screen.

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  disposeCapture,
  readCapture,
  startCapture,
  stopCapture,
} from "./demo-recorder/capture.mjs";
import { installOverlay } from "./demo-recorder/overlay.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SCENARIO_DIR = path.join(REPO_ROOT, "scripts", "demo-scenarios");
const READ_CHUNK_BYTES = 4 * 1024 * 1024;
const VIDEO_BITS_PER_SECOND = 16_000_000;
// Mouse events sent to the app while the overlay cursor glides, so hover
// effects along the path line up with the drawn cursor.
const MOUSE_STEP_MS = 33;
// How long hover transitions get to finish before a target is re-measured.
const SETTLE_MS = 220;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function usage(message) {
  if (message) {
    console.error(`Error: ${message}\n`);
  }
  console.error(
    "Usage: node scripts/record-demo.mjs <scenario> <out.mp4> [--cdp-port PORT] [--fps N] [--keep-webm]\n" +
      "Options and step syntax are documented at the top of scripts/record-demo.mjs.",
  );
  process.exit(message ? 1 : 0);
}

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "cdp-port": { type: "string", default: process.env.CDP_PORT ?? "9222" },
      fps: { type: "string", default: "60" },
      "keep-webm": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    usage();
  }
  if (positionals.length !== 2) {
    usage("expected a scenario and an output path");
  }
  const fps = Number(values.fps);
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    usage("--fps must be an integer from 1 to 120");
  }
  return {
    scenario: positionals[0],
    output: path.resolve(positionals[1]),
    cdpPort: values["cdp-port"],
    fps,
    keepWebm: values["keep-webm"],
  };
}

async function loadScenario(nameOrPath) {
  const file = /\.[cm]?js$/.test(nameOrPath)
    ? path.resolve(nameOrPath)
    : path.join(SCENARIO_DIR, `${nameOrPath}.mjs`);
  if (!existsSync(file)) {
    throw new Error(`scenario not found: ${file}`);
  }
  const scenario = await import(pathToFileURL(file).href);
  if (!Array.isArray(scenario.steps)) {
    throw new Error(`${file} must export a \`steps\` array`);
  }
  return scenario;
}

/** ffmpeg-static ships without its binary (see pnpm-workspace.yaml); download it on first use. */
async function resolveFfmpeg() {
  const require = createRequire(path.join(REPO_ROOT, "package.json"));
  const binary = require("ffmpeg-static");
  if (binary && existsSync(binary)) {
    return binary;
  }

  console.log("Downloading the ffmpeg binary (first run only)...");
  const installer = path.join(
    path.dirname(require.resolve("ffmpeg-static/package.json")),
    "install.js",
  );
  await run(process.execPath, [installer], { stdio: "inherit" });
  if (!binary || !existsSync(binary)) {
    throw new Error("ffmpeg-static did not produce a binary");
  }
  return binary;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "pipe"], ...options });
    let stderr = "";
    child.stderr?.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${path.basename(command)} exited ${code}\n${stderr}`)),
    );
  });
}

async function connect(cdpPort) {
  // playwright is a dev dependency of packages/ui only, so resolve it from there.
  const require = createRequire(path.join(REPO_ROOT, "packages", "ui", "package.json"));
  const { chromium } = require("playwright");
  const endpoint = `http://127.0.0.1:${cdpPort}`;
  let browser;
  try {
    browser = await chromium.connectOverCDP(endpoint);
  } catch {
    throw new Error(
      `no CDP endpoint at ${endpoint}. Start the app with:\n` +
        `  GAMELORD_DEMO_RECORDER=1 CDP_PORT=${cdpPort} pnpm --filter @gamelord/desktop dev`,
    );
  }
  const pages = browser.contexts().flatMap((context) => context.pages());
  // The library window; the game window loads game-window.html.
  const page = pages.find((p) => !p.url().includes("game-window")) ?? pages[0];
  if (!page) {
    throw new Error("no pages found over CDP");
  }
  return { browser, page };
}

/** Drives the overlay cursor and Playwright input together. */
class Director {
  constructor(page, cursor) {
    this.page = page;
    this.cursor = cursor;
  }

  async resolve(target, optional) {
    if (typeof target === "object" && target !== null) {
      return target;
    }
    const locator = this.page.locator(target).first();
    try {
      await locator.waitFor({ state: "visible", timeout: optional ? 1500 : 10_000 });
    } catch (error) {
      if (optional) {
        return null;
      }
      throw new Error(`target not visible: ${target}`, { cause: error });
    }
    const box = await locator.boundingBox();
    if (!box) {
      if (optional) {
        return null;
      }
      throw new Error(`target has no box: ${target}`);
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async glide(to, duration) {
    const from = { ...this.cursor };
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const ms = duration ?? Math.round(Math.min(1100, Math.max(450, 350 + distance * 0.6)));
    const drawn = this.page.evaluate(({ x, y, ms }) => window.__demoOverlay.glide(x, y, ms), {
      ...to,
      ms,
    });
    const start = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / ms);
      const k = easeInOutCubic(t);
      await this.page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      if (t >= 1) {
        break;
      }
      await sleep(MOUSE_STEP_MS);
    }
    await drawn;
    this.cursor = { ...to };
  }

  /**
   * Glide to a target, then re-measure it: hover effects (a card scaling up,
   * a toolbar sliding in) can move the target once the cursor arrives, so
   * follow it before clicking. Returns false when an optional target is missing.
   */
  async moveTo(target, optional, duration) {
    let to = await this.resolve(target, optional);
    if (!to) {
      return false;
    }
    await this.glide(to, duration);
    for (let attempt = 0; attempt < 2 && typeof target === "string"; attempt++) {
      await sleep(SETTLE_MS);
      to = await this.resolve(target, optional);
      if (!to || Math.hypot(to.x - this.cursor.x, to.y - this.cursor.y) < 2) {
        break;
      }
      await this.glide(to, 200);
    }
    return true;
  }

  async step(step) {
    const optional = Boolean(step.optional);
    if ("caption" in step) {
      await this.page.evaluate((text) => window.__demoOverlay.setCaption(text), step.caption);
    } else if ("wait" in step) {
      await sleep(step.wait);
    } else if ("glide" in step) {
      await this.moveTo(step.glide, optional, step.duration);
    } else if ("click" in step) {
      if (!(await this.moveTo(step.click, optional, step.duration))) {
        return;
      }
      await sleep(80);
      await this.click();
      await sleep(250);
    } else if ("type" in step) {
      if (step.into) {
        if (!(await this.moveTo(step.into, optional, step.duration))) {
          return;
        }
        await this.click();
        await sleep(200);
      }
      await this.page.keyboard.type(step.type, { delay: step.delay ?? 85 });
    } else if ("press" in step) {
      await this.page.keyboard.press(step.press);
    } else {
      throw new Error(`unknown step: ${JSON.stringify(step)}`);
    }
  }

  async click() {
    const pressed = this.page.evaluate(() => window.__demoOverlay.press());
    await this.page.mouse.click(this.cursor.x, this.cursor.y, { delay: 70 });
    await pressed;
  }
}

async function downloadCapture(page, size, file) {
  const out = createWriteStream(file);
  for (let offset = 0; offset < size; offset += READ_CHUNK_BYTES) {
    const base64 = await page.evaluate(readCapture, { offset, length: READ_CHUNK_BYTES });
    if (!out.write(Buffer.from(base64, "base64"))) {
      await new Promise((resolve) => out.once("drain", resolve));
    }
  }
  await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
}

async function main() {
  const options = parseCli();
  const scenario = await loadScenario(options.scenario);
  const ffmpeg = await resolveFfmpeg();
  const { browser, page } = await connect(options.cdpPort);

  const webm = options.output.replace(/\.mp4$/i, "") + ".webm";
  await mkdir(path.dirname(options.output), { recursive: true });

  try {
    await scenario.setup?.(page);
    const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    const director = new Director(page, { x: viewport.w * 0.5, y: viewport.h * 0.62 });
    await page.mouse.move(director.cursor.x, director.cursor.y);
    await page.evaluate(installOverlay, director.cursor);

    const { mimeType, settings } = await page.evaluate(startCapture, {
      fps: options.fps,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    });
    console.log(
      `Recording ${settings.width}x${settings.height} @ ${settings.frameRate}fps (${mimeType})`,
    );

    await sleep(400);
    for (const [index, step] of scenario.steps.entries()) {
      try {
        await director.step(step);
      } catch (error) {
        throw new Error(`step ${index + 1} failed: ${error.message}`, { cause: error });
      }
    }
    await page.evaluate(() => window.__demoOverlay.setCaption(null));
    await sleep(600);

    const size = await page.evaluate(stopCapture);
    await downloadCapture(page, size, webm);
    console.log(`Captured ${(size / 1024 / 1024).toFixed(1)} MB of WebM`);
  } finally {
    await page.evaluate(disposeCapture).catch(() => {});
    await page.evaluate(() => window.__demoOverlay?.remove()).catch(() => {});
    await browser.close();
  }

  await run(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    webm,
    // MediaRecorder writes variable timestamps; resample to a constant rate.
    "-vf",
    `fps=${options.fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    options.output,
  ]);
  if (!options.keepWebm) {
    await rm(webm);
  }
  console.log(options.output);
}

try {
  await main();
} catch (error) {
  // Keep the first line; Playwright appends an in-page stack trace.
  console.error(`Error: ${error.message.split("\n")[0].replace(/^page\.evaluate: Error: /, "")}`);
  process.exit(1);
}
