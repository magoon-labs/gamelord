import * as Sentry from "@sentry/electron/renderer";
import { init as reactInit } from "@sentry/react";
import type { GamelordAPI } from "./types/global";

/**
 * Initialize Sentry in a renderer process (library window or game window).
 *
 * The DSN, release, and environment are inherited from the main process
 * via IPC — no configuration needed here beyond renderer-specific options.
 *
 * Does nothing unless the main process initialized Sentry (signalled through
 * the preload's `sentryEnabled` flag): without the main-process SDK there is
 * no `sentry-ipc://` protocol to talk to.
 *
 * Session Replay is configured to record only on errors (the 30-second
 * buffer before the error), keeping quota usage low on the free tier.
 */
export function initSentryRenderer(): void {
  const api = (window as unknown as { gamelord?: GamelordAPI }).gamelord;
  if (!api?.sentryEnabled) {
    return;
  }

  Sentry.init(
    {
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    },
    reactInit,
  );
}
