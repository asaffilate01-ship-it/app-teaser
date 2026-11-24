import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INSTALL_DISMISS_KEY,
  installMode,
  installSnoozed,
  type InstallMode,
} from "@/lib/install-app";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The browser fires this once, often before React mounts; keep it for whichever screen asks first.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((notify) => notify());
  });
}

function useInstallMode(): InstallMode {
  const [mode, setMode] = useState<InstallMode>("none");
  useEffect(() => {
    const update = () =>
      setMode(
        installMode({
          userAgent: navigator.userAgent,
          standalone:
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as { standalone?: boolean }).standalone === true,
          canPrompt: deferredPrompt !== null,
          maxTouchPoints: navigator.maxTouchPoints,
        }),
      );
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return mode;
}

async function runPrompt() {
  const prompt = deferredPrompt;
  if (!prompt) return;
  await prompt.prompt();
  await prompt.userChoice.catch(() => null);
  deferredPrompt = null;
  listeners.forEach((notify) => notify());
}

function IosSteps({ mode }: { mode: InstallMode }) {
  return (
    <ol className="install-steps">
      {mode === "ios-other" && (
        <li>
          Open this page in <strong>Safari</strong> (copy the link, then paste it into Safari).
        </li>
      )}
      <li>
        Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" />{" "}
        <strong>Share</strong> at the bottom of the screen.
      </li>
      <li>
        Scroll down and tap{" "}
        <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" />{" "}
        <strong>Add to Home Screen</strong>.
      </li>
      <li>
        Tap <strong>Add</strong>. CricLume opens full screen from its icon, like any app.
      </li>
    </ol>
  );
}

/** Small "Install app" button for headers. Hidden once installed or where the browser cannot install. */
export function InstallButton() {
  const mode = useInstallMode();
  const [open, setOpen] = useState(false);
  if (mode === "installed" || mode === "none") return null;
  return (
    <>
      <button
        type="button"
        className="app-icon-button install-button"
        aria-label="Install the CricLume app"
        title="Install app"
        onClick={() => (mode === "prompt" ? void runPrompt() : setOpen(true))}
      >
        <Download className="size-4" aria-hidden="true" />
        <span className="hidden md:inline">Install</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="install-dialog">
          <DialogHeader>
            <DialogTitle>Add CricLume to your home screen</DialogTitle>
            <DialogDescription>
              Score from an icon on your phone, full screen and quicker to open.
            </DialogDescription>
          </DialogHeader>
          <IosSteps mode={mode} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One-time banner on phones, dismissible for 30 days. */
export function InstallBanner() {
  const mode = useInstallMode();
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => {
    try {
      setSnoozed(installSnoozed(window.localStorage.getItem(INSTALL_DISMISS_KEY)));
    } catch {
      setSnoozed(false);
    }
  }, []);
  if (snoozed || mode === "installed" || mode === "none") return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, new Date().toISOString());
    } catch {
      // Private mode: the banner simply comes back next visit.
    }
    setSnoozed(true);
  };
  return (
    <aside className="install-banner" aria-label="Install the app">
      <img src="/icon-maskable-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Get the CricLume app</p>
        {mode === "prompt" ? (
          <p className="text-xs text-muted-foreground">
            Install it on this device — free, no app store needed.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {mode === "ios-other" ? "Open in Safari, then " : ""}Tap{" "}
            <Share className="inline size-3.5 align-text-bottom" aria-label="Share" /> then “Add to
            Home Screen”.
          </p>
        )}
      </div>
      {mode === "prompt" && (
        <button
          type="button"
          className="action-primary min-h-10 px-4"
          onClick={() => void runPrompt()}
        >
          Install
        </button>
      )}
      <button type="button" className="app-icon-button" aria-label="Not now" onClick={dismiss}>
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
