import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const { ipcMainMock } = vi.hoisted(() => ({
  ipcMainMock: { current: null as EventEmitter | null },
}));

vi.mock("electron", () => ({
  get ipcMain() {
    return ipcMainMock.current;
  },
}));

import {
  createGameWindowStartup,
  GAME_RENDERER_READY_CHANNEL,
  onGameRendererReady,
} from "./gameWindowStartup";

function setup(hasHeroTransition: boolean) {
  const calls: Array<string> = [];
  const startup = createGameWindowStartup({
    hasHeroTransition,
    sendInitialState: () => calls.push("state"),
    startBoot: () => calls.push("boot"),
  });
  return { calls, startup };
}

describe("createGameWindowStartup", () => {
  it("sends nothing until the renderer is ready", () => {
    const { calls, startup } = setup(true);
    startup.handleHeroFinished();
    expect(calls).toEqual([]);
  });

  it("sends the state before booting when there is no card animation", () => {
    const { calls, startup } = setup(false);
    startup.handleRendererReady();
    expect(calls).toEqual(["state", "boot"]);
  });

  it("holds the boot until the card animation finishes", () => {
    const { calls, startup } = setup(true);
    startup.handleRendererReady();
    expect(calls).toEqual(["state"]);
    startup.handleHeroFinished();
    expect(calls).toEqual(["state", "boot"]);
  });

  it("boots when the renderer is ready after the card animation finished", () => {
    const { calls, startup } = setup(true);
    startup.handleHeroFinished();
    startup.handleRendererReady();
    expect(calls).toEqual(["state", "boot"]);
  });

  it("does not boot twice if the card animation finishes again", () => {
    const { calls, startup } = setup(true);
    startup.handleRendererReady();
    startup.handleHeroFinished();
    startup.handleHeroFinished();
    expect(calls).toEqual(["state", "boot"]);
  });

  it("resends the state and boots again after a reload", () => {
    const { calls, startup } = setup(false);
    startup.handleRendererReady();
    startup.handleRendererReady();
    expect(calls).toEqual(["state", "boot", "state", "boot"]);
  });
});

describe("onGameRendererReady", () => {
  function createWindow() {
    const window = new EventEmitter() as EventEmitter & { webContents: object };
    window.webContents = {};
    return window;
  }

  it("only reacts to its own window and stops once the window closes", () => {
    ipcMainMock.current = new EventEmitter();
    const window = createWindow();
    const callback = vi.fn();
    onGameRendererReady(window as never, callback);

    ipcMainMock.current.emit(GAME_RENDERER_READY_CHANNEL, { sender: {} });
    expect(callback).not.toHaveBeenCalled();

    ipcMainMock.current.emit(GAME_RENDERER_READY_CHANNEL, { sender: window.webContents });
    expect(callback).toHaveBeenCalledTimes(1);

    window.emit("closed");
    ipcMainMock.current.emit(GAME_RENDERER_READY_CHANNEL, { sender: window.webContents });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(ipcMainMock.current.listenerCount(GAME_RENDERER_READY_CHANNEL)).toBe(0);
  });
});
