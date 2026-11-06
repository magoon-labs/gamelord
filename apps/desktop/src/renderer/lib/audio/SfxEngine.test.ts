import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";

// AudioContext and related APIs are mocked before each import of SfxEngine.
// The module creates a singleton on import, so every test gets a fresh one.

function createMockAudioBuffer(): AudioBuffer {
  return {
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
    duration: 0.1,
    getChannelData: () => new Float32Array(4410),
    length: 4410,
    numberOfChannels: 1,
    sampleRate: 44_100,
  } as unknown as AudioBuffer;
}

function createMockGainNode(): GainNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  } as unknown as GainNode;
}

function createMockSourceNode(): AudioBufferSourceNode {
  return {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as AudioBufferSourceNode;
}

let mockCtxState: AudioContextState = "running";
let mockResume: ReturnType<typeof vi.fn>;
let mockGainNode: GainNode;
let mockSourceNode: AudioBufferSourceNode;

function setupGlobalMocks() {
  mockCtxState = "running";
  mockResume = vi.fn(() => Promise.resolve());
  mockGainNode = createMockGainNode();
  mockSourceNode = createMockSourceNode();

  globalThis.AudioContext = vi.fn(function (this: Record<string, unknown>) {
    this.sampleRate = 44_100;
    this.destination = {};
    this.resume = mockResume;
    this.createGain = () => mockGainNode;
    this.createBuffer = () => createMockAudioBuffer();
    this.createBufferSource = () => mockSourceNode;
    Object.defineProperty(this, "state", {
      get() {
        return mockCtxState;
      },
    });
  }) as unknown as typeof AudioContext;
}

describe("SfxEngine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    setupGlobalMocks();
  });

  // Each test's singleton outlives vi.resetModules(), so consume its one-shot
  // gesture listener here to stop it reacting to the next test's gestures.
  afterEach(() => {
    userGesture();
  });

  async function importFreshEngine() {
    const mod = await import("./SfxEngine");
    return mod.sfxEngine;
  }

  function userGesture(type: "keydown" | "pointerdown" = "pointerdown") {
    window.dispatchEvent(new Event(type));
  }

  it("reads default preferences (enabled=true, volume=0.5)", async () => {
    const engine = await importFreshEngine();
    const prefs = engine.getPreferences();
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(0.5);
  });

  it("reads saved preferences from localStorage", async () => {
    localStorage.setItem("gamelord:sfx-enabled", "false");
    localStorage.setItem("gamelord:sfx-volume", "0.8");
    const engine = await importFreshEngine();
    const prefs = engine.getPreferences();
    expect(prefs.enabled).toBe(false);
    expect(prefs.volume).toBe(0.8);
  });

  describe("lazy AudioContext creation", () => {
    it("creates nothing on import", async () => {
      await importFreshEngine();
      expect(AudioContext).not.toHaveBeenCalled();
    });

    it.each(["pointerdown", "keydown"] as const)("creates it on the first %s", async (type) => {
      await importFreshEngine();
      expect(AudioContext).not.toHaveBeenCalled();
      userGesture(type);
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it("creates it only once across repeated gestures", async () => {
      await importFreshEngine();
      userGesture("pointerdown");
      userGesture("keydown");
      userGesture("pointerdown");
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it("creates it on the first play() when no gesture came first", async () => {
      const engine = await importFreshEngine();
      expect(AudioContext).not.toHaveBeenCalled();
      engine.play("click");
      expect(AudioContext).toHaveBeenCalledTimes(1);
      expect(mockSourceNode.start).toHaveBeenCalledWith(0);
    });

    it("cancels the pending gesture listener once play() has created it", async () => {
      const engine = await importFreshEngine();
      engine.play("click");
      userGesture();
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it("creates none when disabled at load, even after gestures and play()", async () => {
      localStorage.setItem("gamelord:sfx-enabled", "false");
      const engine = await importFreshEngine();
      userGesture("pointerdown");
      userGesture("keydown");
      engine.play("click");
      expect(AudioContext).not.toHaveBeenCalled();
      expect(mockSourceNode.start).not.toHaveBeenCalled();
    });

    it("creates none after being disabled while a gesture listener is pending", async () => {
      const engine = await importFreshEngine();
      engine.setEnabled(false);
      userGesture();
      engine.play("click");
      expect(AudioContext).not.toHaveBeenCalled();
    });

    it("creates it on the next gesture after setEnabled(true)", async () => {
      localStorage.setItem("gamelord:sfx-enabled", "false");
      const engine = await importFreshEngine();
      userGesture();
      engine.setEnabled(true);
      expect(AudioContext).not.toHaveBeenCalled();
      userGesture();
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it("creates it on the next play() after setEnabled(true)", async () => {
      localStorage.setItem("gamelord:sfx-enabled", "false");
      const engine = await importFreshEngine();
      engine.setEnabled(true);
      engine.play("toggleOn");
      expect(AudioContext).toHaveBeenCalledTimes(1);
      userGesture();
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it("keeps the existing context when toggled off and back on", async () => {
      const engine = await importFreshEngine();
      userGesture();
      engine.setEnabled(false);
      engine.setEnabled(true);
      userGesture();
      engine.play("click");
      expect(AudioContext).toHaveBeenCalledTimes(1);
      expect(mockSourceNode.start).toHaveBeenCalledWith(0);
    });

    it("does not create it for preference changes alone", async () => {
      const engine = await importFreshEngine();
      engine.setVolume(0.2);
      engine.getPreferences();
      engine.subscribe(() => {})();
      expect(AudioContext).not.toHaveBeenCalled();
    });

    it("applies the stored volume once created", async () => {
      localStorage.setItem("gamelord:sfx-volume", "0.8");
      await importFreshEngine();
      userGesture();
      expect(mockGainNode.gain.value).toBe(0.8);
    });

    it("applies a volume set before creation", async () => {
      const engine = await importFreshEngine();
      engine.setVolume(0.25);
      expect(mockGainNode.gain.value).toBe(1); // untouched mock default
      engine.play("click");
      expect(mockGainNode.gain.value).toBe(0.25);
    });
  });

  it("play() is a no-op when disabled", async () => {
    const engine = await importFreshEngine();
    engine.setEnabled(false);
    engine.play("click");
    expect(mockSourceNode.start).not.toHaveBeenCalled();
  });

  it("play() creates a buffer source and starts it", async () => {
    const engine = await importFreshEngine();
    engine.play("click");
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockSourceNode.start).toHaveBeenCalledWith(0);
  });

  it("resumes suspended AudioContext on play()", async () => {
    mockCtxState = "suspended";
    const engine = await importFreshEngine();
    engine.play("click");
    expect(mockResume).toHaveBeenCalled();
  });

  it("setEnabled persists to localStorage", async () => {
    const engine = await importFreshEngine();
    engine.setEnabled(false);
    expect(localStorage.getItem("gamelord:sfx-enabled")).toBe("false");
    expect(engine.getPreferences().enabled).toBe(false);
  });

  it("setVolume persists to localStorage and updates gain", async () => {
    const engine = await importFreshEngine();
    userGesture();
    engine.setVolume(0.75);
    expect(localStorage.getItem("gamelord:sfx-volume")).toBe("0.75");
    expect(engine.getPreferences().volume).toBe(0.75);
    expect(mockGainNode.gain.value).toBe(0.75);
  });

  it("setVolume clamps to [0, 1]", async () => {
    const engine = await importFreshEngine();
    engine.setVolume(1.5);
    expect(engine.getPreferences().volume).toBe(1);
    engine.setVolume(-0.3);
    expect(engine.getPreferences().volume).toBe(0);
  });

  it("subscribe notifies listeners on preference changes", async () => {
    const engine = await importFreshEngine();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    engine.setEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);

    engine.setVolume(0.3);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    engine.setEnabled(true);
    expect(listener).toHaveBeenCalledTimes(2); // no more calls after unsubscribe
  });

  it("reuses the same AudioContext across multiple plays", async () => {
    const engine = await importFreshEngine();
    engine.play("click");
    engine.play("toggleOn");
    engine.play("saveState");
    // Only the one from the first play() — later plays don't create new ones
    expect(AudioContext).toHaveBeenCalledTimes(1);
  });
});
