import { describe, it, expect } from "vitest";
import { KEYBOARD_KEYS, retroButtonForKeyEvent } from "./keymap";

const B = 0;
const SELECT = 2;
const START = 3;
const A = 8;

type KeyEvent = Pick<KeyboardEvent, "code" | "key">;

/** The `code`/`key` pair a browser reports for a physical key. */
const ev = (code: string, key: string): KeyEvent => ({ code, key });

/**
 * Feeds key-down/key-up events through the lookup the way the game window's
 * handlers do and returns the buttons left held.
 */
function heldAfter(events: ReadonlyArray<["down" | "up", KeyEvent]>): Set<number> {
  const held = new Set<number>();
  for (const [type, e] of events) {
    const retroId = retroButtonForKeyEvent(e);
    if (retroId === undefined) {
      continue;
    }
    if (type === "down") {
      held.add(retroId);
    } else {
      held.delete(retroId);
    }
  }
  return held;
}

describe("retroButtonForKeyEvent", () => {
  it("maps KeyX to B without Shift", () => {
    expect(retroButtonForKeyEvent(ev("KeyX", "x"))).toBe(B);
  });

  it("maps KeyX to B while Shift is held", () => {
    expect(retroButtonForKeyEvent(ev("KeyX", "X"))).toBe(B);
  });

  it("ignores Caps Lock for every letter key", () => {
    for (const [code, letter] of [
      ["KeyX", "x"],
      ["KeyS", "s"],
      ["KeyZ", "z"],
      ["KeyA", "a"],
      ["KeyQ", "q"],
      ["KeyW", "w"],
    ]) {
      const lower = retroButtonForKeyEvent(ev(code, letter));
      expect(lower).toBeDefined();
      expect(retroButtonForKeyEvent(ev(code, letter.toUpperCase()))).toBe(lower);
    }
  });

  it("maps both Shift keys to Select", () => {
    expect(retroButtonForKeyEvent(ev("ShiftLeft", "Shift"))).toBe(SELECT);
    expect(retroButtonForKeyEvent(ev("ShiftRight", "Shift"))).toBe(SELECT);
  });

  it("maps both Enter keys to Start", () => {
    expect(retroButtonForKeyEvent(ev("Enter", "Enter"))).toBe(START);
    expect(retroButtonForKeyEvent(ev("NumpadEnter", "Enter"))).toBe(START);
  });

  it("matches the physical key on a non-QWERTY layout", () => {
    // AZERTY: the physical Z key types "w".
    expect(retroButtonForKeyEvent(ev("KeyZ", "w"))).toBe(A);
  });

  it("returns undefined for keys that aren't game buttons", () => {
    expect(retroButtonForKeyEvent(ev("Space", " "))).toBeUndefined();
    expect(retroButtonForKeyEvent(ev("Tab", "Tab"))).toBeUndefined();
    expect(retroButtonForKeyEvent(ev("F5", "F5"))).toBeUndefined();
  });

  it("releases B when X is let go after Shift was pressed", () => {
    // Hold X, press Shift, release X, release Shift.
    expect(
      heldAfter([
        ["down", ev("KeyX", "x")],
        ["down", ev("ShiftLeft", "Shift")],
        ["up", ev("KeyX", "X")],
        ["up", ev("ShiftLeft", "Shift")],
      ]),
    ).toEqual(new Set());
  });

  it("holds Select and B together for Shift+X", () => {
    expect(
      heldAfter([
        ["down", ev("ShiftRight", "Shift")],
        ["down", ev("KeyX", "X")],
      ]),
    ).toEqual(new Set([SELECT, B]));
  });
});

describe("KEYBOARD_KEYS", () => {
  it("uses each physical key for only one button", () => {
    const codes = KEYBOARD_KEYS.flatMap((k) => k.codes);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("maps each button from only one entry", () => {
    const ids = KEYBOARD_KEYS.map((k) => k.retroId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
