import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ActiveFilterChips, type ActiveFilter } from "./ActiveFilterChips";
import { Button } from "./ui/button";

const meta = {
  title: "Components/ActiveFilterChips",
  component: ActiveFilterChips,
  decorators: [
    (Story) => (
      <div className="flex justify-end bg-background p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActiveFilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {
  /* storybook action placeholder */
};

/** Rendered from mount. Chips animate only when added later. */
export const Static: Story = {
  args: {
    filters: [
      { key: "platform", label: "Super Nintendo Entertainment System", onRemove: noop },
      { key: "genre", label: "Action", onRemove: noop },
      { key: "favorites", label: "Favorites", onRemove: noop },
    ],
  },
};

export const NoFilters: Story = {
  args: { filters: [] },
};

const toggleableLabels = ["Arcade", "Action", "Favorites"];

/** Toggles chips in and out so the entrance and exit can be tried by hand. */
function ToggleableChips() {
  const [active, setActive] = useState<Array<string>>(["Action"]);
  const toggle = (label: string) =>
    setActive((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  const filters: Array<ActiveFilter> = toggleableLabels
    .filter((label) => active.includes(label))
    .map((label) => ({ key: label, label, onRemove: () => toggle(label) }));

  return (
    <div className="flex w-full flex-col items-end gap-4">
      <div className="flex gap-2">
        {toggleableLabels.map((label) => (
          <Button key={label} onClick={() => toggle(label)} size="sm" variant="outline">
            Toggle {label}
          </Button>
        ))}
      </div>
      <ActiveFilterChips filters={filters} />
    </div>
  );
}

/**
 * New chips slot into filter order, removed chips leave after their exit, and
 * re-adding a chip mid-exit keeps it rather than leaving a duplicate.
 */
export const AddAndRemove: Story = {
  args: { filters: [] },
  render: () => <ToggleableChips />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = (label: string) =>
      userEvent.click(canvas.getByRole("button", { name: `Toggle ${label}` }));
    const chipLabels = () =>
      within(canvas.getByRole("group", { name: "Active filters" }))
        .queryAllByRole("button")
        .filter((button) => !(button as HTMLButtonElement).disabled)
        .map((button) => button.textContent);

    await toggle("Arcade");
    await toggle("Favorites");
    await expect(chipLabels()).toEqual(["Arcade ✕", "Action ✕", "Favorites ✕"]);

    // Removing a chip keeps it in the DOM for the exit, then drops it
    await toggle("Action");
    await expect(chipLabels()).toEqual(["Arcade ✕", "Favorites ✕"]);
    const actionChip = canvas.getByRole("button", { name: "Remove Action filter" });
    await expect(actionChip).toBeDisabled();
    await waitFor(() => expect(actionChip).not.toBeInTheDocument());

    // Re-adding mid-exit revives the same chip
    await toggle("Favorites");
    const favoritesChip = canvas.getByRole("button", { name: "Remove Favorites filter" });
    await expect(favoritesChip).toBeDisabled();
    await toggle("Favorites");
    await expect(canvas.getByRole("button", { name: "Remove Favorites filter" })).toBe(
      favoritesChip,
    );
    await expect(favoritesChip).toBeEnabled();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(favoritesChip).toBeInTheDocument();
    await expect(chipLabels()).toEqual(["Arcade ✕", "Favorites ✕"]);
  },
};
