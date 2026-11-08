// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DisplayLock } from "./display-lock";

const NES_FPS = 60.0988;

/** Feeds `count` refreshes at `hz`, starting at `start`, and returns the last one's time. */
function feed(
  lock: DisplayLock,
  hz: number,
  count: number,
  start = 1_000_000,
  late = false,
): number {
  const period = 1000 / hz;
  let t = start;
  for (let i = 0; i < count; i++) {
    t = start + i * period;
    lock.onVsync(t, late);
  }
  return t;
}

describe("DisplayLock", () => {
  it("stays unlocked until refreshes have been regular for a while", () => {
    const lock = new DisplayLock(NES_FPS);
    const last = feed(lock, 60, 10);
    expect(lock.nextRun(last + 1)).toBeNull();
    const later = feed(lock, 60, 40, last + 1000 / 60);
    expect(lock.nextRun(later + 1)).not.toBeNull();
  });

  it("runs each frame the margin ahead of the next refresh", () => {
    const lock = new DisplayLock(NES_FPS);
    lock.recordRunCost(0.5);
    const last = feed(lock, 60, 60);
    const state = lock.state(last + 2);
    expect(state.locked).toBe(true);
    expect(state.refreshesPerFrame).toBe(1);
    const next = lock.nextRun(last + 2);
    expect(next).not.toBeNull();
    expect(next!.refreshAt).toBeCloseTo(last + 1000 / 60, 5);
    expect(next!.runAt).toBeCloseTo(next!.refreshAt - state.marginMs, 5);
  });

  it("schedules one core frame per refresh, never two", () => {
    const lock = new DisplayLock(NES_FPS);
    const period = 1000 / 60;
    const last = feed(lock, 60, 60);
    const first = lock.nextRun(last + 2)!.runAt;
    // Right after that frame runs, the next one goes a full refresh later.
    const second = lock.nextRun(first + 0.3)!.runAt;
    expect(second - first).toBeCloseTo(period, 1);
    // A run that starts 5 ms late still targets the following refresh, not a catch-up.
    const third = lock.nextRun(second + 5)!.runAt;
    expect(third - second).toBeCloseTo(period, 1);
  });

  it("runs one core frame every other refresh at 120 Hz", () => {
    const lock = new DisplayLock(NES_FPS);
    const last = feed(lock, 120, 80);
    expect(lock.state(last + 1).refreshesPerFrame).toBe(2);
    const first = lock.nextRun(last + 1)!.runAt;
    const second = lock.nextRun(first + 0.3)!.runAt;
    expect(second - first).toBeCloseTo(1000 / 60, 1);
    expect(lock.lockedFps(last + 1)).toBeCloseTo(60, 1);
  });

  it.each([
    [59.94, true],
    [60, true],
    [120, true],
    [144, false],
    [75, false],
    [50, false],
  ])("at %s Hz, locked is %s", (hz, locked) => {
    const lock = new DisplayLock(NES_FPS);
    const last = feed(lock, hz, 80);
    expect(lock.state(last + 1).locked).toBe(locked);
  });

  it("unlocks when refreshes stop, as when the window is hidden", () => {
    const lock = new DisplayLock(NES_FPS);
    const last = feed(lock, 60, 60);
    expect(lock.nextRun(last + 10)).not.toBeNull();
    expect(lock.nextRun(last + 100)).toBeNull();
  });

  it("stays locked through a single unreported refresh", () => {
    const lock = new DisplayLock(NES_FPS);
    const period = 1000 / 60;
    const last = feed(lock, 60, 60);
    lock.onVsync(last + 2 * period, false);
    expect(lock.state(last + 2 * period + 1).locked).toBe(true);
  });

  it("unlocks when the window moves to a 50 Hz display", () => {
    const lock = new DisplayLock(NES_FPS);
    const last = feed(lock, 60, 60);
    const moved = feed(lock, 50, 60, last + 20);
    expect(lock.state(moved + 1).locked).toBe(false);
  });

  it("starts counting again after an irregular refresh", () => {
    const lock = new DisplayLock(NES_FPS);
    const period = 1000 / 60;
    const last = feed(lock, 60, 60);
    // Half a refresh late: neither regular nor a whole number of missed refreshes.
    const odd = last + 1.5 * period;
    lock.onVsync(odd, false);
    const resumed = feed(lock, 60, 10, odd + period);
    expect(lock.state(resumed + 1).locked).toBe(false);
    const settled = feed(lock, 60, 30, resumed + period);
    expect(lock.state(settled + 1).locked).toBe(true);
  });

  it("widens the margin when frames arrive late, then slowly narrows it", () => {
    const lock = new DisplayLock(NES_FPS);
    let last = feed(lock, 60, 60);
    const before = lock.state(last + 1).marginMs;
    last = feed(lock, 60, 4, last + 1000 / 60, true);
    const widened = lock.state(last + 1).marginMs;
    expect(widened).toBeCloseTo(before + 2, 5);
    last = feed(lock, 60, 1200, last + 1000 / 60);
    expect(lock.state(last + 1).marginMs).toBeCloseTo(widened - 0.25, 5);
  });

  it("unlocks a core too slow to fit its slot", () => {
    const lock = new DisplayLock(NES_FPS);
    lock.recordRunCost(14);
    const last = feed(lock, 60, 60);
    expect(lock.state(last + 1).locked).toBe(false);
  });

  it("reports audio at the rate the locked frames play", () => {
    const lock = new DisplayLock(NES_FPS);
    expect(lock.audioSampleRate(48_000, 0)).toBe(48_000);
    const last = feed(lock, 60, 60);
    expect(lock.audioSampleRate(48_000, last + 1)).toBeCloseTo((48_000 * 60) / NES_FPS, 0);
  });
});

describe("DisplayLock with jittery timestamps", () => {
  it("keeps the audio rate steady when refresh timestamps jitter", () => {
    const lock = new DisplayLock(NES_FPS);
    const period = 1000 / 60;
    let seed = 7;
    const jitter = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return (seed / 2 ** 31 - 0.5) * 4; // ±2 ms, like a software rAF timer
    };
    const rates: Array<number> = [];
    for (let i = 0; i < 2000; i++) {
      const t = 1_000_000 + i * period + jitter();
      lock.onVsync(t, false);
      if (i > 600) {
        rates.push(lock.audioSampleRate(48_000, t + 1));
      }
    }
    const spread = (Math.max(...rates) - Math.min(...rates)) / 48_000;
    expect(spread).toBeLessThan(0.001);
  });
});
