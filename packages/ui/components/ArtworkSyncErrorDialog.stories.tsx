import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent } from "storybook/test";
import { ArtworkSyncErrorDialog } from "./ArtworkSyncErrorDialog";

const meta = {
  component: ArtworkSyncErrorDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  title: "Components/ArtworkSyncErrorDialog",
  args: {
    errorCode: "auth-failed",
    onDismiss: fn(),
    onUpdateCredentials: fn(),
  },
} satisfies Meta<typeof ArtworkSyncErrorDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthFailed: Story = {
  args: { errorCode: "auth-failed" },
  play: async ({ args }) => {
    const dialog = await screen.findByRole("alertdialog");
    // Enters with the shared AlertDialog scan-in animation, not a pop-in.
    await expect(dialog).toHaveAttribute("data-state", "open");
    await expect(dialog.className).toContain("data-[state=open]:animate-dialog-scan-in");

    await expect(screen.getByText("ScreenScraper Sign-In Failed")).toBeVisible();
    await expect(screen.getByText(/rejected your username or password/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Update Credentials" }));
    await expect(args.onUpdateCredentials).toHaveBeenCalledOnce();
    await expect(args.onDismiss).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};

export const ConfigError: Story = {
  args: { errorCode: "config-error" },
  play: async ({ args }) => {
    const dialog = await screen.findByRole("alertdialog");
    await expect(dialog).toHaveAttribute("data-state", "open");

    await expect(screen.getByText("Artwork Sync Unavailable")).toBeVisible();
    await expect(screen.getByText(/developer credentials are missing/)).toBeVisible();
    await expect(screen.queryByRole("button", { name: "Update Credentials" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
    await expect(args.onUpdateCredentials).not.toHaveBeenCalled();
  },
};

export const EscapeDismisses: Story = {
  args: { errorCode: "config-error" },
  play: async ({ args }) => {
    await screen.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};

export const Closed: Story = {
  args: { errorCode: null },
  play: async () => {
    await expect(screen.queryByRole("alertdialog")).toBeNull();
  },
};
