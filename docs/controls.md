# Controls

GameLord maps your keyboard and gamepads to the libretro RetroPad, the virtual controller every core reads input from. Cores translate RetroPad buttons to their own system's buttons, so the on-screen name of a button can differ per system.

In a game window, press <kbd>?</kbd> or <kbd>F1</kbd> to show the controls overlay. It pauses the game while it's open.

## Keyboard

The keyboard drives player 1.

| Key                                                 | RetroPad button |
| --------------------------------------------------- | --------------- |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | D-Pad           |
| <kbd>Z</kbd>                                        | A               |
| <kbd>X</kbd>                                        | B               |
| <kbd>A</kbd>                                        | X               |
| <kbd>S</kbd>                                        | Y               |
| <kbd>Q</kbd>                                        | L               |
| <kbd>W</kbd>                                        | R               |
| <kbd>Enter</kbd>                                    | Start           |
| <kbd>Shift</kbd>                                    | Select          |

Keyboard keys can't be remapped yet ([#82](https://github.com/magoon-labs/gamelord/issues/82)).

## Game window shortcuts

| Key                           | Action                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| <kbd>Space</kbd>              | Pause or resume                                              |
| <kbd>Tab</kbd>                | Toggle fast-forward                                          |
| <kbd>F5</kbd>                 | Save state to the selected slot                              |
| <kbd>F9</kbd>                 | Load state from the selected slot                            |
| <kbd>F6</kbd>                 | Open or close the disc swap overlay (multi-disc games only)  |
| <kbd>?</kbd> or <kbd>F1</kbd> | Show or hide the controls overlay                            |
| <kbd>Esc</kbd>                | Close the controls overlay, disc swap overlay or cheat panel |

<kbd>Tab</kbd> switches between 1x and the last fast-forward speed you picked from the toolbar's speed menu (2x by default). Save and load use the slot (0–4) picked in the game window's toolbar, which starts at slot 0. <kbd>F5</kbd> and <kbd>F9</kbd> do nothing when the core doesn't support save states. Shortcuts are ignored while you're typing in a text field, and <kbd>Space</kbd> only pauses when no button or other control has focus.

## Library window shortcuts

<kbd>Cmd</kbd> on macOS, <kbd>Ctrl</kbd> on Windows.

| Key                                                              | Action                            |
| ---------------------------------------------------------------- | --------------------------------- |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd>                    | Open or close the command palette |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>,</kbd>                    | Open settings                     |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | Scan library                      |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> | Add ROM folder                    |

## Gamepads

Controllers that the browser reports with the standard gamepad mapping work out of the box; other controllers are ignored. The first two connected controllers play as players 1 and 2. Buttons map by position: the bottom, right, left and top face buttons are RetroPad B, A, Y and X; the shoulder buttons are L and R; the triggers are L2 and R2; the stick clicks are L3 and R3; and the left stick also works as a D-Pad. You can remap the buttons of each controller in **Settings → Controllers**, and the mapping is saved for that controller. Keyboard keys aren't remappable yet ([#82](https://github.com/magoon-labs/gamelord/issues/82)).
