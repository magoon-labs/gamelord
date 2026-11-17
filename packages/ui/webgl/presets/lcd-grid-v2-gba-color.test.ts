import { describe, it, expect } from "vitest";
import { lcdGridV2GbaColorPreset } from "./lcd-grid-v2-gba-color";
import { lcdGridV2GbaColorMotionblurPreset } from "./lcd-grid-v2-gba-color-motionblur";
import { PRESET_LIST, PRESET_MAP } from "./index";

describe("lcd-grid-v2-gba-color preset", () => {
  it("is registered in PRESET_LIST", () => {
    const found = PRESET_LIST.find((p) => p.id === "lcd-grid-v2-gba-color");
    expect(found).toBeDefined();
    expect(found!.label).toBe("LCD GBA");
  });

  it("is registered in PRESET_MAP", () => {
    expect(PRESET_MAP.get("lcd-grid-v2-gba-color")).toBe(lcdGridV2GbaColorPreset);
  });

  it("has no LUT textures", () => {
    expect(lcdGridV2GbaColorPreset.luts).toHaveLength(0);
  });

  describe("pass 0 — lcd-grid-v2", () => {
    const pass = lcdGridV2GbaColorPreset.passes[0];

    it("scales at viewport resolution", () => {
      expect(pass.scale).toEqual({ type: "viewport", x: 1, y: 1 });
    });

    it("uses nearest filtering", () => {
      expect(pass.filter).toBe("nearest");
    });

    it("uses rgba8 format", () => {
      expect(pass.format).toBe("rgba8");
    });
  });

  describe("pass 1 — gba-color", () => {
    const pass = lcdGridV2GbaColorPreset.passes[1];

    it("scales at source resolution", () => {
      expect(pass.scale).toEqual({ type: "source", x: 1, y: 1 });
    });

    it("uses nearest filtering", () => {
      expect(pass.filter).toBe("nearest");
    });
  });
});

describe("lcd-grid-v2-gba-color-motionblur preset", () => {
  it("is registered in PRESET_LIST", () => {
    const found = PRESET_LIST.find((p) => p.id === "lcd-grid-v2-gba-color-motionblur");
    expect(found).toBeDefined();
    expect(found!.label).toBe("LCD GBA + Motion Blur");
  });

  it("is registered in PRESET_MAP", () => {
    expect(PRESET_MAP.get("lcd-grid-v2-gba-color-motionblur")).toBe(
      lcdGridV2GbaColorMotionblurPreset,
    );
  });

  it("has no LUT textures", () => {
    expect(lcdGridV2GbaColorMotionblurPreset.luts).toHaveLength(0);
  });

  describe("pass 0 — lcd-response-time", () => {
    const pass = lcdGridV2GbaColorMotionblurPreset.passes[0];

    it("scales at source resolution", () => {
      expect(pass.scale).toEqual({ type: "source", x: 1, y: 1 });
    });

    it("has self-feedback enabled", () => {
      expect(pass.feedback).toBe(true);
    });

    it("uses nearest filtering", () => {
      expect(pass.filter).toBe("nearest");
    });
  });

  describe("pass 1 — lcd-grid-v2", () => {
    const pass = lcdGridV2GbaColorMotionblurPreset.passes[1];

    it("scales at viewport resolution", () => {
      expect(pass.scale).toEqual({ type: "viewport", x: 1, y: 1 });
    });

    it("does not have feedback", () => {
      expect(pass.feedback).toBeUndefined();
    });
  });

  describe("pass 2 — gba-color", () => {
    const pass = lcdGridV2GbaColorMotionblurPreset.passes[2];

    it("scales at source resolution", () => {
      expect(pass.scale).toEqual({ type: "source", x: 1, y: 1 });
    });
  });
});

describe("GLSL sources", () => {
  it("all lcd-grid-v2-gba-color passes have valid GLSL ES 3.0 shaders", () => {
    for (const pass of lcdGridV2GbaColorPreset.passes) {
      expect(pass.fragmentSource.length).toBeGreaterThan(100);
      expect(pass.fragmentSource).toContain("#version 300 es");
    }
  });

  it("all lcd-grid-v2-gba-color-motionblur passes have valid GLSL ES 3.0 shaders", () => {
    for (const pass of lcdGridV2GbaColorMotionblurPreset.passes) {
      expect(pass.fragmentSource.length).toBeGreaterThan(100);
      expect(pass.fragmentSource).toContain("#version 300 es");
    }
  });
});
