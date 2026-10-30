import type { ArtworkSyncBlockingErrorCode } from "@gamelord/ui";

/** How a failed artwork sync is surfaced in the library window. */
export type ArtworkSyncErrorPresentation =
  | { errorCode: ArtworkSyncBlockingErrorCode; kind: "dialog" }
  | { kind: "banner"; message: string };

/** Errors that mean sync can't work at all, so the user must acknowledge them. */
export function isBlockingSyncError(
  errorCode: string | undefined,
): errorCode is ArtworkSyncBlockingErrorCode {
  return errorCode === "auth-failed" || errorCode === "config-error";
}

/**
 * Map an `artwork:syncError` payload to a dialog (blocking errors) or a
 * banner message (everything else).
 */
export function presentSyncError(
  errorCode: string | undefined,
  error: string,
): ArtworkSyncErrorPresentation {
  if (isBlockingSyncError(errorCode)) {
    return { errorCode, kind: "dialog" };
  }

  switch (errorCode) {
    case "rate-limited":
      return {
        kind: "banner",
        message: "Artwork sync failed: ScreenScraper is rate limiting requests. Try again later.",
      };
    case "timeout":
      return {
        kind: "banner",
        message: "Artwork sync failed: ScreenScraper is not responding. Try again later.",
      };
    case "network-error":
      return {
        kind: "banner",
        message:
          "Artwork sync failed: could not connect to ScreenScraper. Check your internet connection.",
      };
    default:
      return { kind: "banner", message: `Artwork sync failed: ${error}` };
  }
}
