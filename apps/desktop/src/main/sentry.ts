import * as Sentry from "@sentry/electron/main";
import { app } from "electron";
import { SENTRY_ENABLED_ARG } from "../types/sentry";

let sentryEnabled = false;

/**
 * Initialize Sentry crash reporting in the main process.
 *
 * Does nothing when `SENTRY_DSN` is not set, so development environments
 * without a DSN work without errors.
 *
 * Default integrations provide:
 * - SentryMinidump — captures native crashes (addon segfaults) with full breadcrumbs
 * - ElectronOfflineNetTransport — queues events to disk when offline
 * - MainProcessSession — tracks app session health
 */
export function initSentryMain(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    release: `gamelord@${app.getVersion()}`,
    environment: app.isPackaged ? "production" : "development",
  });
  sentryEnabled = true;
}

/**
 * Extra renderer command-line arguments that tell the preload whether the
 * main-process SDK is running. Pass to `webPreferences.additionalArguments`
 * on every BrowserWindow so renderers only start Sentry when main did.
 */
export function sentryRendererArguments(): Array<string> {
  return sentryEnabled ? [SENTRY_ENABLED_ARG] : [];
}
