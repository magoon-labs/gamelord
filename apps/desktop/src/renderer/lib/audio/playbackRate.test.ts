import { describe, expect, it } from "vitest";
import { audioPlaybackRate, MAX_RATE_ADJUSTMENT } from "./playbackRate";

describe("audioPlaybackRate", () => {
  it("plays at normal speed when the queue is on target", () => {
    expect(audioPlaybackRate(0.06, 0.06)).toBe(1);
  });

  it("slows down when the queue runs low, so it refills", () => {
    expect(audioPlaybackRate(0.03, 0.06)).toBeCloseTo(1 - MAX_RATE_ADJUSTMENT / 2, 6);
  });

  it("speeds up when the queue grows, so delay doesn't build", () => {
    expect(audioPlaybackRate(0.09, 0.06)).toBeCloseTo(1 + MAX_RATE_ADJUSTMENT / 2, 6);
  });

  it("never changes the rate by more than the limit", () => {
    expect(audioPlaybackRate(0, 0.06)).toBeCloseTo(1 - MAX_RATE_ADJUSTMENT, 6);
    expect(audioPlaybackRate(1, 0.06)).toBeCloseTo(1 + MAX_RATE_ADJUSTMENT, 6);
  });
});
