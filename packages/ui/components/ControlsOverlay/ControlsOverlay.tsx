import React, { useEffect, useRef, useState } from "react";
import { ControllerDiagram } from "./ControllerDiagram";
import { KeyBadge } from "./KeyBadge";
import type { KeyboardBinding } from "./controller-layouts";

export interface ControlsOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Keyboard-to-button bindings to display. Derived from the emulator's actual KEY_MAP. */
  bindings: ReadonlyArray<KeyboardBinding>;
  /**
   * Whether the current game has more than one disc. The F6 disc swap
   * shortcut only does something for multi-disc games, so it's listed only then.
   */
  hasMultipleDiscs?: boolean;
}

interface ShortcutMapping {
  /** Keys that trigger the shortcut, rendered as separate badges. */
  keys: ReadonlyArray<string>;
  label: string;
  /** Listed only when the current game has more than one disc. */
  multiDiscOnly?: boolean;
}

/** Mirrors the game window's keyboard shortcut handler. */
const SHORTCUTS: ReadonlyArray<ShortcutMapping> = [
  { keys: ["Space"], label: "Pause" },
  { keys: ["Tab"], label: "Fast-forward" },
  { keys: ["F5"], label: "Save State" },
  { keys: ["F9"], label: "Load State" },
  { keys: ["F6"], label: "Disc Swap", multiDiscOnly: true },
  { keys: ["F1", "?"], label: "Controls" },
];

/**
 * Delay (ms) to keep the DOM mounted after `open` goes false so exit
 * animations have time to play. Matches the longest close animation
 * (dialog-scan-out at 200ms) plus a small buffer.
 */
const UNMOUNT_DELAY = 220;

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  open,
  onClose,
  bindings,
  hasMultipleDiscs = false,
}) => {
  // Delayed unmount: keep the DOM alive while exit animations play.
  const [mounted, setMounted] = useState(open);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setMounted(true);
    } else if (mounted) {
      timerRef.current = setTimeout(() => {
        setMounted(false);
        timerRef.current = null;
      }, UNMOUNT_DELAY);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  if (!open && !mounted) {
    return null;
  }

  const closing = !open && mounted;
  const shortcuts = SHORTCUTS.filter((shortcut) => !shortcut.multiDiscOnly || hasMultipleDiscs);

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center ${closing ? "animate-overlay-fade-out pointer-events-none" : "animate-overlay-fade-in"}`}
      role="dialog"
      aria-label="Keyboard Controls"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        data-testid="controls-overlay-backdrop"
        onClick={closing ? undefined : onClose}
      />

      {/* Panel */}
      <div
        className={`relative z-10 bg-black/90 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl ${closing ? "animate-dialog-scan-out" : "animate-dialog-scan-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controller bindings */}
        <ControllerDiagram bindings={bindings} />

        {/* Shortcuts */}
        <div className="border-t border-white/10 mt-4 pt-3">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.label}
                className="flex items-center gap-1.5"
                data-testid={`shortcut-${shortcut.keys.join("-")}`}
              >
                {shortcut.keys.map((key) => (
                  <KeyBadge key={key}>{key}</KeyBadge>
                ))}
                <span className="text-xs text-white/50">{shortcut.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-white/30">
          Press <KeyBadge>Esc</KeyBadge> or <KeyBadge>?</KeyBadge> to close
        </p>
      </div>
    </div>
  );
};
