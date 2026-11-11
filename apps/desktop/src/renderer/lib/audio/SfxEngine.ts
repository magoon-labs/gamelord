/**
 * Singleton sound effects engine.
 *
 * Manages a dedicated AudioContext (separate from the emulation audio),
 * pre-renders all UI sounds into AudioBuffers, and exposes a fire-and-forget
 * `play()` method.
 *
 * The AudioContext registers a system audio client, so it isn't created until
 * it's needed. When sound effects are enabled, the first user gesture creates
 * it, paying the ~500ms OS audio subsystem init before the first `play()`
 * rather than during it. A `play()` with no prior gesture creates it instead.
 * It is never created while sound effects are disabled. A context created
 * outside a gesture starts suspended per autoplay policy, and `play()` resumes
 * it.
 *
 * Preferences (enabled, volume) are persisted to localStorage and
 * exposed via a subscribe/getSnapshot pattern for useSyncExternalStore.
 */
import { soundGenerators } from "./sounds";

export type SfxId = keyof typeof soundGenerators;

export interface SfxPreferences {
  enabled: boolean;
  /** Volume scalar in [0, 1]. */
  volume: number;
}

type Listener = () => void;

const STORAGE_KEY_ENABLED = "gamelord:sfx-enabled";
const STORAGE_KEY_VOLUME = "gamelord:sfx-volume";

/** Capture phase, so a gesture counts even if a handler stops propagation. */
const GESTURE_LISTENER_OPTIONS = { capture: true, passive: true };

/** The AudioContext and everything derived from it, created together. */
interface SfxAudio {
  buffers: Map<SfxId, AudioBuffer>;
  ctx: AudioContext;
  gainNode: GainNode;
}

class SfxEngine {
  private audio: SfxAudio | null = null;
  private preferences: SfxPreferences;
  private listeners = new Set<Listener>();

  constructor() {
    const storedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
    const storedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
    this.preferences = {
      enabled: storedEnabled !== "false", // default true
      volume: storedVolume !== null ? Number.parseFloat(storedVolume) : 0.5,
    };

    if (this.preferences.enabled) {
      this.addGestureListeners();
    }
  }

  /** Fire-and-forget sound playback. No-op when disabled. */
  play(id: SfxId): void {
    if (!this.preferences.enabled) {
      return;
    }

    const { buffers, ctx, gainNode } = this.getOrCreateAudio();

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const buffer = buffers.get(id);
    if (!buffer) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(0);
  }

  /**
   * Return the current preferences object.
   *
   * This returns the same reference until a preference changes (setEnabled/
   * setVolume replace the object), which is required for useSyncExternalStore
   * to avoid infinite re-render loops via Object.is comparison.
   */
  getPreferences(): SfxPreferences {
    return this.preferences;
  }

  setEnabled(enabled: boolean): void {
    this.preferences = { ...this.preferences, enabled };
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    if (!enabled) {
      this.removeGestureListeners();
    } else if (!this.audio) {
      this.addGestureListeners();
    }
    this.notify();
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.preferences = { ...this.preferences, volume: clamped };
    localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    if (this.audio) {
      this.audio.gainNode.gain.value = clamped;
    }
    this.notify();
  }

  /** Subscribe for preference changes (useSyncExternalStore compatible). */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getOrCreateAudio(): SfxAudio {
    if (this.audio) {
      return this.audio;
    }

    this.removeGestureListeners();

    const ctx = new AudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = this.preferences.volume;
    gainNode.connect(ctx.destination);

    const buffers = new Map<SfxId, AudioBuffer>();
    for (const [id, generator] of Object.entries(soundGenerators)) {
      buffers.set(id as SfxId, generator(ctx));
    }

    this.audio = { buffers, ctx, gainNode };
    return this.audio;
  }

  private readonly handleGesture = (): void => {
    this.getOrCreateAudio();
  };

  private addGestureListeners(): void {
    window.addEventListener("pointerdown", this.handleGesture, GESTURE_LISTENER_OPTIONS);
    window.addEventListener("keydown", this.handleGesture, GESTURE_LISTENER_OPTIONS);
  }

  private removeGestureListeners(): void {
    window.removeEventListener("pointerdown", this.handleGesture, GESTURE_LISTENER_OPTIONS);
    window.removeEventListener("keydown", this.handleGesture, GESTURE_LISTENER_OPTIONS);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const sfxEngine = new SfxEngine();
