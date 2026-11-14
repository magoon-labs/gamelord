import type { DisplayMediaRequestHandlerHandlerRequest, Session, Streams } from "electron";

/** Set to "1" (with an unpackaged dev build) to let scripts/record-demo.mjs capture the app. */
export const DEMO_RECORDER_ENV = "GAMELORD_DEMO_RECORDER";

/**
 * The demo recorder only runs in an unpackaged dev build that opted in through
 * the environment. A packaged build never auto-approves screen capture.
 */
export function isDemoRecorderEnabled(
  isPackaged: boolean,
  env: Record<string, string | undefined>,
): boolean {
  return !isPackaged && env[DEMO_RECORDER_ENV] === "1";
}

/**
 * Auto-approve `getDisplayMedia()` with the requesting frame as the source, so
 * the recorder captures the app's own web contents at the compositor's frame
 * rate. It skips the source picker and needs no OS screen-recording
 * permission. Returns whether the handler was registered.
 */
export function registerDemoRecorderCapture(
  target: Pick<Session, "setDisplayMediaRequestHandler">,
  isPackaged: boolean,
  env: Record<string, string | undefined>,
): boolean {
  if (!isDemoRecorderEnabled(isPackaged, env)) {
    return false;
  }
  target.setDisplayMediaRequestHandler(
    (request: DisplayMediaRequestHandlerHandlerRequest, callback: (streams: Streams) => void) => {
      // An empty grant denies the request.
      callback(request.frame ? { video: request.frame } : {});
    },
  );
  return true;
}
