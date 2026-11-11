/**
 * Keyboard → libretro joypad mapping for player 1.
 *
 * Keys are matched by physical key (`KeyboardEvent.code`), not by the
 * character they produce (`KeyboardEvent.key`). Shift is itself a game button
 * (Select), and Shift or Caps Lock turn `key` into uppercase letters, so a
 * character-based lookup drops Select+button combinations and can miss a
 * key-up, leaving the button held. `code` is the same for key-down and key-up
 * regardless of modifiers, and keeps the same physical layout on non-QWERTY
 * keyboards.
 */
export interface KeyboardKey {
  /** `KeyboardEvent.code` values that press this button. */
  codes: ReadonlyArray<string>;
  /** Key name shown in the controls overlay (e.g. "z", "Shift", "ArrowUp"). */
  key: string;
  /** Libretro joypad button ID. */
  retroId: number;
}

export const KEYBOARD_KEYS: ReadonlyArray<KeyboardKey> = [
  { codes: ["KeyX"], key: "x", retroId: 0 }, // B
  { codes: ["KeyS"], key: "s", retroId: 1 }, // Y
  { codes: ["ShiftLeft", "ShiftRight"], key: "Shift", retroId: 2 }, // Select
  { codes: ["Enter", "NumpadEnter"], key: "Enter", retroId: 3 }, // Start
  { codes: ["ArrowUp"], key: "ArrowUp", retroId: 4 }, // Up
  { codes: ["ArrowDown"], key: "ArrowDown", retroId: 5 }, // Down
  { codes: ["ArrowLeft"], key: "ArrowLeft", retroId: 6 }, // Left
  { codes: ["ArrowRight"], key: "ArrowRight", retroId: 7 }, // Right
  { codes: ["KeyZ"], key: "z", retroId: 8 }, // A
  { codes: ["KeyA"], key: "a", retroId: 9 }, // X
  { codes: ["KeyQ"], key: "q", retroId: 10 }, // L
  { codes: ["KeyW"], key: "w", retroId: 11 }, // R
];

const RETRO_ID_BY_CODE: ReadonlyMap<string, number> = new Map(
  KEYBOARD_KEYS.flatMap(({ codes, retroId }) => codes.map((code) => [code, retroId] as const)),
);

/** Libretro button for a keyboard event's physical key, or undefined if it isn't a game key. */
export function retroButtonForKeyEvent(e: Pick<KeyboardEvent, "code">): number | undefined {
  return RETRO_ID_BY_CODE.get(e.code);
}
