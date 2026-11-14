// In-page capture for scripts/record-demo.mjs. The page records itself with
// getDisplayMedia + MediaRecorder; the dev app's main process auto-approves
// the request when GAMELORD_DEMO_RECORDER=1 (see apps/desktop/src/main/demoRecorder.ts).
//
// Every function here is serialized into the page with page.evaluate(), so it
// must not reference anything outside its own body.

/**
 * Start recording the page. Resolves once the recorder is running.
 *
 * @param {{ fps: number, videoBitsPerSecond: number }} options
 */
export async function startCapture({ fps, videoBitsPerSecond }) {
  const scale = window.devicePixelRatio || 1;
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: {
        frameRate: { ideal: fps, max: fps },
        width: { ideal: Math.round(window.innerWidth * scale) },
        height: { ideal: Math.round(window.innerHeight * scale) },
      },
    });
  } catch (error) {
    throw new Error(
      `getDisplayMedia was not approved (${error?.name ?? "Error"}: ${error?.message ?? error}). ` +
        "Start the dev app with GAMELORD_DEMO_RECORDER=1.",
      { cause: error },
    );
  }

  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  const chunks = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  const started = new Promise((resolve) =>
    recorder.addEventListener("start", resolve, { once: true }),
  );
  recorder.start(1000);
  await started;

  window.__demoCapture = { stream, recorder, chunks, mimeType, blob: null };
  return { mimeType, settings: stream.getVideoTracks()[0].getSettings() };
}

/** Stop recording and keep the WebM as a Blob for readCapture(). Returns its size in bytes. */
export async function stopCapture() {
  const capture = window.__demoCapture;
  if (!capture) {
    return 0;
  }
  if (capture.recorder.state !== "inactive") {
    const stopped = new Promise((resolve) =>
      capture.recorder.addEventListener("stop", resolve, { once: true }),
    );
    capture.recorder.stop();
    await stopped;
  }
  for (const track of capture.stream.getTracks()) {
    track.stop();
  }
  capture.blob = new Blob(capture.chunks, { type: capture.mimeType });
  return capture.blob.size;
}

/**
 * Read one slice of the stopped recording as base64.
 *
 * @param {{ offset: number, length: number }} range
 */
export async function readCapture({ offset, length }) {
  const slice = window.__demoCapture.blob.slice(offset, offset + length);
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(slice);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/** Stop any capture still running and drop its data. */
export function disposeCapture() {
  const capture = window.__demoCapture;
  if (!capture) {
    return;
  }
  if (capture.recorder.state !== "inactive") {
    capture.recorder.stop();
  }
  for (const track of capture.stream.getTracks()) {
    track.stop();
  }
  delete window.__demoCapture;
}
