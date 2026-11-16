# GameLord Architecture

GameLord is a native emulator frontend (OpenEmu-style) where Electron handles UI/library management and libretro cores are loaded directly via a native Node addon (`gamelord_libretro.node`) using dlopen. No external emulator processes.

## How It Works

1. **Native addon** (`apps/desktop/native/src/libretro_core.cc`) loads libretro `.dylib` cores directly, implementing the full libretro frontend API (environment callbacks, video/audio/input)
2. **Utility process** (`core-worker.ts`) runs the emulation loop in a dedicated Electron utility process with hybrid sleep+spin frame pacing (~0.1-0.5ms jitter). When the display's refresh rate is within 1% of a whole multiple of the core's rate, `display-lock.ts` times each core frame to finish just before a refresh, using the `requestAnimationFrame` timestamps the game window sends back. Otherwise, or when those timestamps stop, frames run on the free-running timer.
3. **Video and audio** go straight from the worker to the game window over a `MessagePort`, bypassing the main process so its work can't delay them. Main creates the channel when the window reports it's ready, and the preload hands the port to the page with `window.postMessage`, because `contextBridge` would copy every frame. Messages are still copied by structured clone. A `SharedArrayBuffer` can't cross into a utility process, so true zero-copy would need a different mechanism. `EmulationWorkerClient` manages the worker lifecycle and request/response protocol.
4. **Renderer** buffers the latest frame, then uploads it as a texture and draws it through the multi-pass shader pipeline in `packages/ui/webgl/` on the next `requestAnimationFrame`. Audio plays via Web Audio API with seamless chunk scheduling, nudging the playback rate by at most 0.5% to keep the queue near its pre-buffer
5. **Input** is captured in the renderer (keyboard events and gamepad polling) and forwarded through the main process to the utility process worker via IPC. Unlike video and audio, it can still be delayed by main process work.

## Key Files

```
apps/desktop/native/src/
├── libretro_core.cc          - Native addon: dlopen, libretro API, frame/audio buffers
├── libretro_core.h           - Native addon header
├── libretro.h                - Libretro API definitions
└── addon.cc                  - N-API module registration

apps/desktop/src/main/
├── GameWindowManager.ts      - Game window lifecycle, frame/audio forwarding to renderer
├── emulator/
│   ├── EmulatorCore.ts       - Abstract base class
│   ├── LibretroNativeCore.ts - Path validation & config for native mode
│   ├── EmulationWorkerClient.ts - Spawns & communicates with utility process worker
│   ├── RetroArchCore.ts      - Legacy RetroArch process mode (overlay)
│   └── EmulatorManager.ts    - Core selection & orchestration
├── workers/
│   ├── core-worker.ts        - Utility process: emulation loop, native addon, frame pacing
│   ├── display-lock.ts       - Times core frames to the display refresh
│   └── core-worker-protocol.ts - Shared message types (worker ↔ main, worker ↔ game window)
└── ipc/
    └── handlers.ts           - IPC endpoints

apps/desktop/src/renderer/components/
└── GameWindow.tsx            - Canvas rendering, audio playback, controls overlay

packages/ui/webgl/            - WebGL renderer and shader presets

apps/desktop/src/preload.ts   - Renderer API bridge
```

## Supported Cores

- **NES:** fceumm (primary), nestopia, mesen
- **PSX:** pcsx_rearmed (PCSX ReARMed, primary), mednafen_psx_hw (Beetle PSX HW), swanstation (SwanStation) — requires BIOS file (`scph5501.bin`). SwanStation (DuckStation fork) enables full chtdb cheat support including extended code types.
- **Sega Saturn:** mednafen_saturn (Beetle Saturn, primary), yabause — requires BIOS files (`sega_101.bin`, `mpr-17933.bin`)
- **GameCube:** dolphin (Dolphin) — no BIOS files required (HLE BIOS)
- Cores located at: `~/Library/Application Support/GameLord/cores/`
- BIOS files located at: `~/Library/Application Support/GameLord/BIOS/` (created automatically on startup, mirrors OpenEmu convention)
