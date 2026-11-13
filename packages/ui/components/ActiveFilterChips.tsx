import React, { useEffect, useRef, useState } from "react";
import { badgeVariants } from "./ui/badge";
import { cn } from "../utils";

export interface ActiveFilter {
  /** Chip identity. A new key animates the old chip out and the new one in. */
  key: string;
  label: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  filters: Array<ActiveFilter>;
}

interface RenderedChip {
  filter: ActiveFilter;
  isExiting: boolean;
}

/** Keep in sync with `duration-[180ms]` on the chip. */
const EXIT_DURATION_MS = 180;

/** Applies the latest filters, leaving removed chips in place to animate out. */
function mergeChips(chips: Array<RenderedChip>, filters: Array<ActiveFilter>): Array<RenderedChip> {
  const activeKeys = new Set(filters.map((filter) => filter.key));
  const merged: Array<RenderedChip> = [];
  let nextFilter = 0;

  for (const chip of chips) {
    if (!activeKeys.has(chip.filter.key)) {
      merged.push({ filter: chip.filter, isExiting: true });
      continue;
    }
    // Emit filters up to this surviving chip, which keeps new chips in filter order.
    while (nextFilter < filters.length) {
      const filter = filters[nextFilter++];
      merged.push({ filter, isExiting: false });
      if (filter.key === chip.filter.key) {
        break;
      }
    }
  }
  for (const filter of filters.slice(nextFilter)) {
    merged.push({ filter, isExiting: false });
  }

  return merged;
}

/**
 * Removable chips for the active library filters. Each chip fades and scales
 * in place while its width animates, so neighboring chips glide, not jump.
 * These are CSS transitions, so re-adding a chip mid-exit reverses it smoothly.
 */
export function ActiveFilterChips({ filters }: ActiveFilterChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chips, setChips] = useState<Array<RenderedChip>>(() => mergeChips([], filters));
  const [mergedFilters, setMergedFilters] = useState(filters);

  if (filters !== mergedFilters) {
    setMergedFilters(filters);
    setChips(mergeChips(chips, filters));
  }

  // A later removal restarts the timer. Chips waiting on it are already invisible.
  const exitingKeys = chips
    .filter((chip) => chip.isExiting)
    .map((chip) => chip.filter.key)
    .join("\n");

  useEffect(() => {
    if (exitingKeys === "") {
      return;
    }
    const timer = setTimeout(() => {
      setChips((current) => current.filter((chip) => !chip.isExiting));
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [exitingKeys]);

  /** Keeps a keyboard user's place when the focused chip is about to disappear. */
  const moveFocusFrom = (button: HTMLButtonElement) => {
    const container = containerRef.current;
    const buttons = Array.from(container?.querySelectorAll("button:enabled") ?? []);
    const index = buttons.indexOf(button);
    const target = buttons[index + 1] ?? buttons[index - 1] ?? container;
    (target as HTMLElement | null)?.focus();
  };

  const handleRemove = (event: React.MouseEvent<HTMLButtonElement>, filter: ActiveFilter) => {
    // Keyboard activation of a button reports `detail` 0. Mouse clicks shouldn't
    // move focus, because that would put a focus ring on the neighboring chip.
    if (event.detail === 0) {
      moveFocusFrom(event.currentTarget);
    }
    filter.onRemove();
  };

  return (
    <div
      aria-label="Active filters"
      className="isolate flex items-center outline-none"
      ref={containerRef}
      role="group"
      tabIndex={-1}
    >
      {chips.map(({ filter, isExiting }, index) => (
        <div
          className={cn(
            "grid grid-cols-[1fr] justify-end transition-[grid-template-columns,opacity,scale] duration-[180ms] ease-out",
            "starting:grid-cols-[0fr] starting:opacity-0 starting:scale-90",
            isExiting && "grid-cols-[0fr] opacity-0 scale-95",
          )}
          key={filter.key}
          // Left neighbors stack above, so they slide over a chip that's fading.
          style={{ zIndex: chips.length - index }}
        >
          {/* End alignment holds the chip still in the right-anchored row while its width animates. */}
          <div className="flex min-w-0 justify-end">
            {/* The gap lives inside the animated width, so it collapses with the chip. */}
            <div className="flex w-max shrink-0 pl-2">
              <button
                aria-label={`Remove ${filter.label} filter`}
                className={cn(
                  badgeVariants({ variant: "secondary" }),
                  "cursor-pointer ring-offset-background focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-offset-2",
                )}
                disabled={isExiting}
                onClick={(event) => handleRemove(event, filter)}
                type="button"
              >
                {filter.label} ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
