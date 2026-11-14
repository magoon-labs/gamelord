import { describe, expect, it, vi } from "vitest";
import type { DisplayMediaRequestHandlerHandlerRequest, Streams, WebFrameMain } from "electron";
import {
  DEMO_RECORDER_ENV,
  isDemoRecorderEnabled,
  registerDemoRecorderCapture,
} from "./demoRecorder";

const optedIn = { [DEMO_RECORDER_ENV]: "1" };

describe("isDemoRecorderEnabled", () => {
  it("is enabled only in an unpackaged build with the env var set to 1", () => {
    expect(isDemoRecorderEnabled(false, optedIn)).toBe(true);
  });

  it.each([
    ["a packaged build, even with the env var", true, optedIn],
    ["an unset env var", false, {}],
    ["an env var other than 1", false, { [DEMO_RECORDER_ENV]: "true" }],
    ["an empty env var", false, { [DEMO_RECORDER_ENV]: "" }],
  ])("is disabled for %s", (_label, isPackaged, env) => {
    expect(isDemoRecorderEnabled(isPackaged, env)).toBe(false);
  });
});

describe("registerDemoRecorderCapture", () => {
  function setup() {
    const setDisplayMediaRequestHandler = vi.fn();
    return { setDisplayMediaRequestHandler, target: { setDisplayMediaRequestHandler } };
  }

  it("does not register a handler in a packaged build", () => {
    const { setDisplayMediaRequestHandler, target } = setup();

    expect(registerDemoRecorderCapture(target, true, optedIn)).toBe(false);
    expect(setDisplayMediaRequestHandler).not.toHaveBeenCalled();
  });

  it("does not register a handler when the env var is unset", () => {
    const { setDisplayMediaRequestHandler, target } = setup();

    expect(registerDemoRecorderCapture(target, false, {})).toBe(false);
    expect(setDisplayMediaRequestHandler).not.toHaveBeenCalled();
  });

  it("approves the requesting frame as the video source when enabled", () => {
    const { setDisplayMediaRequestHandler, target } = setup();

    expect(registerDemoRecorderCapture(target, false, optedIn)).toBe(true);
    const handler = setDisplayMediaRequestHandler.mock.calls[0][0] as (
      request: DisplayMediaRequestHandlerHandlerRequest,
      callback: (streams: Streams) => void,
    ) => void;

    const frame = { url: "http://localhost:5173/" } as unknown as WebFrameMain;
    const callback = vi.fn();
    handler({ frame } as DisplayMediaRequestHandlerHandlerRequest, callback);
    expect(callback).toHaveBeenCalledWith({ video: frame });

    const denied = vi.fn();
    handler({ frame: null } as DisplayMediaRequestHandlerHandlerRequest, denied);
    expect(denied).toHaveBeenCalledWith({});
  });
});
