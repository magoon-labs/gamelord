import { describe, expect, it } from "vitest";
import {
  isBlockingSyncError,
  presentBlockingSyncError,
  presentSyncError,
} from "./artworkSyncError";

describe("presentBlockingSyncError", () => {
  it.each([true, false])("shows auth-failed in the dialog (dev build: %s)", (isDevBuild) => {
    expect(presentBlockingSyncError("auth-failed", isDevBuild)).toEqual({
      errorCode: "auth-failed",
      kind: "dialog",
    });
  });

  it("shows config-error in the dialog in dev builds", () => {
    expect(presentBlockingSyncError("config-error", true)).toEqual({
      errorCode: "config-error",
      kind: "dialog",
    });
  });

  it("never shows config-error's .env instructions outside dev builds", () => {
    const presentation = presentBlockingSyncError("config-error", false);
    expect(presentation).toEqual({
      kind: "banner",
      message: "Artwork sync is unavailable in this build.",
    });
  });
});

describe("presentSyncError", () => {
  it("routes blocking errors through the blocking presentation", () => {
    expect(presentSyncError("auth-failed", "boom")).toEqual({
      errorCode: "auth-failed",
      kind: "dialog",
    });
    expect(presentSyncError("config-error", "boom")).toEqual(
      presentBlockingSyncError("config-error"),
    );
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
