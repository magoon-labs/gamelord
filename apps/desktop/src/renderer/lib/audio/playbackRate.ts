/**
 * Playback rate for the next audio chunk, nudged so the scheduled audio stays
 * near its target lookahead. The core's clock, the display's clock and the
 * audio device's clock all differ slightly, so without this the queue slowly
 * drains (gaps) or grows (more delay). A change of at most half a percent
 * isn't audible as a pitch change.
 */
export const MAX_RATE_ADJUSTMENT = 0.005;

export function audioPlaybackRate(queuedSeconds: number, targetSeconds: number): number {
  const error = (queuedSeconds - targetSeconds) / targetSeconds;
  return 1 + MAX_RATE_ADJUSTMENT * Math.max(-1, Math.min(1, error));
}
