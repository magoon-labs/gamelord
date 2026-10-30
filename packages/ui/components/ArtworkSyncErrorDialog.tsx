import React, { useState } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

/** Artwork sync error codes that stop sync entirely and need acknowledgement. */
export type ArtworkSyncBlockingErrorCode = "auth-failed" | "config-error";

export interface ArtworkSyncErrorDialogProps {
  /** The blocking error to show. `null` closes the dialog. */
  errorCode: ArtworkSyncBlockingErrorCode | null;
  onDismiss: () => void;
  /** Opens the ScreenScraper credentials flow. Only offered for `auth-failed`. */
  onUpdateCredentials: () => void;
}

const COPY: Record<
  ArtworkSyncBlockingErrorCode,
  { description: string; icon: typeof AlertTriangle; title: string }
> = {
  "auth-failed": {
    description:
      "Artwork sync stopped because ScreenScraper rejected your username or password, or no account is set.",
    icon: KeyRound,
    title: "ScreenScraper Sign-In Failed",
  },
  "config-error": {
    description:
      "Artwork sync can't run because the ScreenScraper developer credentials are missing from the .env file.",
    icon: AlertTriangle,
    title: "Artwork Sync Unavailable",
  },
};

export const ArtworkSyncErrorDialog: React.FC<ArtworkSyncErrorDialogProps> = ({
  errorCode,
  onDismiss,
  onUpdateCredentials,
}) => {
  // Keep showing the last error while the close animation plays, after
  // the parent has already cleared `errorCode`.
  const [shownCode, setShownCode] = useState(errorCode);
  if (errorCode !== null && errorCode !== shownCode) {
    setShownCode(errorCode);
  }

  const code = errorCode ?? shownCode;
  if (code === null) {
    return null;
  }

  const { description, icon: Icon, title } = COPY[code];

  return (
    <AlertDialog open={errorCode !== null}>
      <AlertDialogContent className="sm:max-w-md" onEscapeKeyDown={onDismiss}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <Icon className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {code === "auth-failed" ? (
            <>
              <AlertDialogCancel onClick={onDismiss}>Dismiss</AlertDialogCancel>
              <AlertDialogAction onClick={onUpdateCredentials}>
                Update Credentials
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={onDismiss}>Dismiss</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
