import { ipcMain, type BrowserWindow, type IpcMainEvent } from "electron";

/** Sent by the game window once its one-shot IPC listeners are registered. */
export const GAME_RENDERER_READY_CHANNEL = "game:renderer-ready";

interface GameWindowStartupOptions {
  hasHeroTransition: boolean;
  /** Send the startup state. Runs on every renderer load, so reloads recover. */
  sendInitialState: () => void;
  /** Start the boot animation. Needs the renderer ready and any card animation finished. */
  startBoot: () => void;
}

/**
 * Orders a game window's startup messages.
 *
 * `did-finish-load` can fire before React runs the effect that registers the
 * listeners, and a message sent before then is lost for good. So nothing is
 * sent until the renderer reports that it's listening.
 */
export function createGameWindowStartup({
  hasHeroTransition,
  sendInitialState,
  startBoot,
}: GameWindowStartupOptions) {
  let rendererReady = false;
  let heroFinished = !hasHeroTransition;

  const startBootIfReady = () => {
    if (rendererReady && heroFinished) {
      rendererReady = false;
      startBoot();
    }
  };

  return {
    handleRendererReady() {
      rendererReady = true;
      sendInitialState();
      startBootIfReady();
    },
    handleHeroFinished() {
      heroFinished = true;
      startBootIfReady();
    },
  };
}

/** Calls `callback` each time this window's renderer reports it's ready. */
export function onGameRendererReady(gameWindow: BrowserWindow, callback: () => void): void {
  const { webContents } = gameWindow;
  const listener = (event: IpcMainEvent) => {
    if (event.sender === webContents) {
      callback();
    }
  };
  ipcMain.on(GAME_RENDERER_READY_CHANNEL, listener);
  gameWindow.once("closed", () => {
    ipcMain.removeListener(GAME_RENDERER_READY_CHANNEL, listener);
  });
}
