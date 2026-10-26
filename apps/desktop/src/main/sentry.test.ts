// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("initSentryMain", () => {
  const originalEnv = process.env.SENTRY_DSN;
  let mockInit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockInit = vi.fn();
    delete process.env.SENTRY_DSN;
    vi.resetModules();

    vi.doMock("@sentry/electron/main", () => ({
      init: mockInit,
    }));
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SENTRY_DSN = originalEnv;
    } else {
      delete process.env.SENTRY_DSN;
    }
  });

  it("does not call Sentry.init when SENTRY_DSN is not set", async () => {
    vi.doMock("electron", () => ({
      app: { getVersion: () => "0.1.0", isPackaged: false },
    }));

    const { initSentryMain } = await import("./sentry");
    initSentryMain();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("does not call Sentry.init when SENTRY_DSN is empty", async () => {
    process.env.SENTRY_DSN = "";
    vi.doMock("electron", () => ({
      app: { getVersion: () => "0.1.0", isPackaged: false },
    }));

    const { initSentryMain } = await import("./sentry");
    initSentryMain();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("calls Sentry.init with the DSN when SENTRY_DSN is set", async () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/123";
    vi.doMock("electron", () => ({
      app: { getVersion: () => "0.1.0", isPackaged: false },
    }));

    const { initSentryMain } = await import("./sentry");
    initSentryMain();

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://abc@sentry.io/123",
        release: "gamelord@0.1.0",
        environment: "development",
      }),
    );
  });

  it("sets environment to production when app.isPackaged is true", async () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/123";
    vi.doMock("electron", () => ({
      app: { getVersion: () => "0.1.0", isPackaged: true },
    }));

    const { initSentryMain } = await import("./sentry");
    initSentryMain();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "production",
      }),
    );
  });
});

describe("sentryRendererArguments", () => {
  const originalEnv = process.env.SENTRY_DSN;

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    vi.resetModules();
    vi.doMock("@sentry/electron/main", () => ({ init: vi.fn() }));
    vi.doMock("electron", () => ({
      app: { getVersion: () => "0.1.0", isPackaged: false },
    }));
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SENTRY_DSN = originalEnv;
    } else {
      delete process.env.SENTRY_DSN;
    }
  });

  it("returns no arguments before initSentryMain has run", async () => {
    const { sentryRendererArguments } = await import("./sentry");
    expect(sentryRendererArguments()).toEqual([]);
  });

  it("returns no arguments when SENTRY_DSN is not set", async () => {
    const { initSentryMain, sentryRendererArguments } = await import("./sentry");
    initSentryMain();
    expect(sentryRendererArguments()).toEqual([]);
  });

  it("returns the enabled flag once the main-process SDK is initialized", async () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/123";
    const { initSentryMain, sentryRendererArguments } = await import("./sentry");
    const { SENTRY_ENABLED_ARG } = await import("../types/sentry");
    initSentryMain();
    expect(sentryRendererArguments()).toEqual([SENTRY_ENABLED_ARG]);
  });
});
