/**
 * Decides when the emulation loop runs each core frame so it lands just before
 * a display refresh, instead of on its own timer. Frames on their own timer
 * wait a varying fraction of a refresh before they're drawn.
 *
 * The game window reports each requestAnimationFrame timestamp. From those, the
 * lock learns the refresh period and phase, and predicts the next refresh. It
 * only locks when the refresh rate is close to a whole multiple of the core's
 * rate (60, 59.94 or 120 Hz for a 60.1 fps core). Otherwise, and whenever the
 * timestamps stop or turn irregular, `nextRunTime` returns null and the loop
 * keeps its free-running timer.
 *
 * Times are epoch milliseconds (`performance.timeOrigin + performance.now()`),
 * which the worker and the game window can both produce.
 */

/** How far the display rate may be from a whole multiple of the core rate. */
export const LOCK_TOLERANCE = 0.01;
/** Consecutive regular refreshes needed before locking. */
const STABLE_TICKS_TO_LOCK = 30;
/** With no refresh for this many periods, the window is hidden or stalled. */
const STALE_PERIODS = 4;
/** A refresh interval this close to the period counts as regular. */
const REGULAR_DEVIATION = 0.25;
/**
 * The period is measured across up to this many refreshes, so timestamp jitter
 * is divided down and doesn't move the audio rate.
 */
const MAX_SPAN_REFRESHES = 1200;
const COST_SMOOTHING = 0.1;

/** Time a frame needs, beyond the core's own run time, to reach the window. */
const INITIAL_BASE_MARGIN_MS = 3;
const MIN_BASE_MARGIN_MS = 1.5;
const MAX_BASE_MARGIN_MS = 8;
const LATE_STEP_MS = 0.5;
const RELAX_STEP_MS = 0.25;
/** Refreshes with no late frame before the margin shrinks again (~20 s at 60 Hz). */
const CLEAN_TICKS_TO_RELAX = 1200;
/** Unlock if a core frame takes more than this share of its slot. */
const MAX_COST_SHARE = 0.75;

export interface DisplayLockState {
  locked: boolean;
  displayHz: number;
  refreshesPerFrame: number;
  marginMs: number;
}

export class DisplayLock {
  private lastVsync = 0;
  private period = 0;
  // Start of the span the period is measured across, and refreshes since.
  private spanStart = 0;
  private spanRefreshes = 0;
  private stableTicks = 0;
  private baseMargin = INITIAL_BASE_MARGIN_MS;
  private cleanTicks = 0;
  private runCost = 0;

  constructor(private readonly coreFps: number) {}

  /**
   * Records a display refresh. `late` means a frame meant for an earlier
   * refresh arrived after it, so the margin needs to grow.
   */
  onVsync(time: number, late: boolean): void {
    this.adjustMargin(late);
    if (this.lastVsync === 0) {
      this.lastVsync = time;
      return;
    }
    const delta = time - this.lastVsync;
    if (delta <= 0) {
      return;
    }
    const previous = this.lastVsync;
    this.lastVsync = time;
    if (this.period === 0) {
      this.restartSpan(previous, delta);
      return;
    }
    const ratio = delta / this.period;
    const refreshes = Math.round(ratio);
    if (Math.abs(ratio - 1) < REGULAR_DEVIATION) {
      this.stableTicks++;
    } else if (ratio >= STALE_PERIODS || Math.abs(ratio - refreshes) >= REGULAR_DEVIATION) {
      this.restartSpan(previous, delta);
      return;
    }
    // Otherwise one or two refreshes went unreported, and the phase still holds.
    this.spanRefreshes += refreshes;
    this.period = (time - this.spanStart) / this.spanRefreshes;
    if (this.spanRefreshes > MAX_SPAN_REFRESHES) {
      this.spanRefreshes = MAX_SPAN_REFRESHES / 2;
      this.spanStart = time - this.spanRefreshes * this.period;
    }
  }

  /** Records how long the last core frame took to run and send. */
  recordRunCost(ms: number): void {
    this.runCost = this.runCost === 0 ? ms : this.runCost + (ms - this.runCost) * COST_SMOOTHING;
  }

  /**
   * When to start the next core frame and the refresh it's for (epoch ms), or
   * null to keep the free-running timer. Call it right after a core frame has run.
   */
  nextRun(now: number): { runAt: number; refreshAt: number } | null {
    const n = this.refreshesPerFrame(now);
    if (n === 0) {
      return null;
    }
    const slot = n * this.period;
    const margin = this.baseMargin + this.runCost;
    // The next refresh whose start time is at least half a slot away. That
    // keeps one core frame per slot even when a run starts a little late.
    const k = Math.floor((now + margin + slot / 2 - this.lastVsync) / this.period) + 1;
    const refreshAt = this.lastVsync + k * this.period;
    return { runAt: refreshAt - margin, refreshAt };
  }

  /** Frames per second the core runs at while locked, or null when unlocked. */
  lockedFps(now: number): number | null {
    const n = this.refreshesPerFrame(now);
    return n === 0 ? null : 1000 / (n * this.period);
  }

  /** The audio sample rate to report, so playback keeps pace with the locked frame rate. */
  audioSampleRate(sampleRate: number, now: number): number {
    const fps = this.lockedFps(now);
    return fps === null ? sampleRate : (sampleRate * fps) / this.coreFps;
  }

  state(now: number): DisplayLockState {
    const n = this.refreshesPerFrame(now);
    return {
      locked: n > 0,
      displayHz: this.period > 0 ? 1000 / this.period : 0,
      refreshesPerFrame: n,
      marginMs: this.baseMargin + this.runCost,
    };
  }

  /** Refreshes per core frame when locked, or 0 when the lock doesn't apply. */
  private refreshesPerFrame(now: number): number {
    if (
      this.stableTicks < STABLE_TICKS_TO_LOCK ||
      now - this.lastVsync > STALE_PERIODS * this.period
    ) {
      return 0;
    }
    const displayHz = 1000 / this.period;
    const n = Math.round(displayHz / this.coreFps);
    if (n < 1 || Math.abs(displayHz / (n * this.coreFps) - 1) > LOCK_TOLERANCE) {
      return 0;
    }
    if (this.baseMargin + this.runCost > MAX_COST_SHARE * n * this.period) {
      return 0;
    }
    return n;
  }

  private restartSpan(start: number, delta: number): void {
    this.spanStart = start;
    this.spanRefreshes = 1;
    this.period = delta;
    this.stableTicks = 0;
  }

  private adjustMargin(late: boolean): void {
    if (late) {
      this.baseMargin = Math.min(MAX_BASE_MARGIN_MS, this.baseMargin + LATE_STEP_MS);
      this.cleanTicks = 0;
    } else if (++this.cleanTicks >= CLEAN_TICKS_TO_RELAX) {
      this.baseMargin = Math.max(MIN_BASE_MARGIN_MS, this.baseMargin - RELAX_STEP_MS);
      this.cleanTicks = 0;
    }
  }
}
