import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { browserServiceWorkerAllowed } from "@/lib/sw-guard";
import { installMode } from "@/lib/install-app";

type Kind = "wickets" | "milestones" | "results";
const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "wickets", label: "Wickets", hint: "Every wicket, with the score" },
  { id: "milestones", label: "Milestones", hint: "Fifties, hundreds and five-fors" },
  { id: "results", label: "Innings and result", hint: "End of each innings, stumps and the result" },
];
type Support = "checking" | "ok" | "preview" | "ios-install" | "unsupported" | "denied";

const storageKey = (slug: string) => `criclume-alerts:${slug}`;
const toKey = (base64: string) => {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

/** "Alerts" button on a public scoreboard: phone notifications for wickets, milestones and the result. */
export function MatchAlerts({ slug }: { slug: string }) {
  const [support, setSupport] = useState<Support>("checking");
  const [kinds, setKinds] = useState<Kind[]>(["wickets", "milestones", "results"]);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const mode = installMode({ userAgent: navigator.userAgent, standalone, canPrompt: false, maxTouchPoints: navigator.maxTouchPoints });
    if (!browserServiceWorkerAllowed()) setSupport(import.meta.env.PROD || "serviceWorker" in navigator ? "preview" : "unsupported");
    else if (!("PushManager" in window) || !("Notification" in window)) setSupport(mode === "ios-safari" || mode === "ios-other" ? "ios-install" : "unsupported");
    else if (Notification.permission === "denied") setSupport("denied");
    else setSupport("ok");
    const saved = window.localStorage.getItem(storageKey(slug));
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Kind[];
        if (Array.isArray(parsed) && parsed.length) {
          setKinds(parsed);
          setOn(true);
        }
      } catch {
        window.localStorage.removeItem(storageKey(slug));
      }
    }
  }, [slug]);

  async function turnOn() {
    if (!kinds.length) {
      toast.error("Pick at least one kind of alert.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "denied" : "ok");
        toast.error("Alerts need permission to show notifications.");
        return;
      }
      const keyResponse = await fetch(`/api/public/push/${slug}`);
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
      if (!publicKey) throw new Error("Alerts are not available right now.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const response = await fetch(`/api/public/push/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), kinds }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not turn on alerts.");
      window.localStorage.setItem(storageKey(slug), JSON.stringify(kinds));
      setOn(true);
      toast.success("Alerts on. We'll buzz you for this match.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not turn on alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/public/push/${slug}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      window.localStorage.removeItem(storageKey(slug));
      setOn(false);
      toast.success("Alerts off for this match.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: Kind) => setKinds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={`hero-chip ${on ? "hero-chip-live" : ""}`} aria-label={on ? "Match alerts on" : "Get match alerts"}>
          {on ? <BellRing className="size-3.5" aria-hidden="true" /> : <Bell className="size-3.5" aria-hidden="true" />}
          <span className="hidden sm:inline">{on ? "Alerts on" : "Alerts"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="alerts-dialog max-w-md">
        <DialogHeader>
          <DialogTitle>Match alerts</DialogTitle>
          <DialogDescription>Get a phone notification when something big happens in this match. No account or email needed.</DialogDescription>
        </DialogHeader>
        {support === "ok" || support === "checking" ? (
          <div className="space-y-4">
            <ul className="space-y-3">
              {KINDS.map((kind) => (
                <li key={kind.id}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox checked={kinds.includes(kind.id)} onCheckedChange={() => toggle(kind.id)} disabled={on || busy} className="mt-0.5" />
                    <span>
                      <span className="block font-semibold">{kind.label}</span>
                      <span className="block text-sm text-muted-foreground">{kind.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {on ? (
              <button type="button" className="action-secondary w-full" onClick={() => void turnOff()} disabled={busy}>
                Turn off alerts
              </button>
            ) : (
              <button type="button" className="action-primary w-full" onClick={() => void turnOn()} disabled={busy || support === "checking"}>
                {busy ? "Turning on…" : "Turn on alerts"}
              </button>
            )}
            <p className="text-xs text-muted-foreground">Alerts never include player names.</p>
          </div>
        ) : (
          <p className="text-sm" role="status">
            {support === "preview" && "Alerts work on the live CricLume site, not in this preview."}
            {support === "ios-install" && "On iPhone, first add CricLume to your Home Screen (Share → Add to Home Screen), then open this scoreboard from there to turn on alerts."}
            {support === "denied" && "Notifications are blocked for this site. Allow them in your browser settings, then try again."}
            {support === "unsupported" && "This browser can't show match alerts. Try Chrome, Edge, Firefox or Safari."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
