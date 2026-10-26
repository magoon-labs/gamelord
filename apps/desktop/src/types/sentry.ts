/**
 * Command-line switch the main process appends to every renderer (via
 * `webPreferences.additionalArguments`) once it has initialized Sentry.
 *
 * This is the single source of truth for whether renderer Sentry runs. The
 * renderer SDK talks to the main-process SDK over the `sentry-ipc://`
 * protocol, which only exists after `Sentry.init` has run in main. Starting
 * the renderer SDK without it logs fetch and connection errors on every load.
 */
export const SENTRY_ENABLED_ARG = "--gamelord-sentry-enabled";
