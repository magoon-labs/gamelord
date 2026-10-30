import { describe, expect, it } from "vitest";
import { isBlockingSyncError, presentSyncError } from "./artworkSyncError";

describe("presentSyncError", () => {
  it.each(["auth-failed", "config-error"] as const)("shows %s in the dialog", (errorCode) => {
    expect(presentSyncError(errorCode, "boom")).toEqual({ errorCode, kind: "dialog" });
  });

  it.each(["rate-limited", "timeout", "network-error"])(
    "keeps %s in the banner, not the dialog",
    (errorCode) => {
      const presentation = presentSyncError(errorCode, "boom");
      expect(presentation.kind).toBe("banner");
      expect(presentation).toHaveProperty("message", expect.stringContaining("ScreenScraper"));
    },
  );

  it("shows unknown errors in the banner with the raw message", () => {
    expect(presentSyncError(undefined, "disk full")).toEqual({
      kind: "banner",
      message: "Artwork sync failed: disk full",
    });
  });
});

describe("isBlockingSyncError", () => {
  it("only treats auth and config failures as blocking", () => {
    expect(isBlockingSyncError("auth-failed")).toBe(true);
    expect(isBlockingSyncError("config-error")).toBe(true);
    expect(isBlockingSyncError("timeout")).toBe(false);
    expect(isBlockingSyncError(undefined)).toBe(false);
  });
});
