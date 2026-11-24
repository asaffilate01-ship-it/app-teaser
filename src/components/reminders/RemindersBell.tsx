import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellRing, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { browserServiceWorkerAllowed } from "@/lib/sw-guard";
import {
  channelLabels,
  normalisePhone,
  reminderMessage,
  type ReminderChannel,
  type ReminderPreferences,
} from "@/lib/reminders";
import {
  countMyDevices,
  loadMyReminders,
  loadPreferences,
  markRead,
  removeDevice,
  saveDevice,
  savePreferences,
  type NotificationRow,
} from "@/lib/reminders-cloud";
import { reminderSetup } from "@/lib/reminders.functions";

type Setup = Awaited<ReturnType<typeof reminderSetup>>;
const toKey = (base64: string) => {
  const padded =
    base64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};
const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Bell in the app header: the person's reminders, and how they want to be reached. */
export function RemindersBell() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"inbox" | "settings">("inbox");
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      setItems(await loadMyReminders());
    } catch {
      setItems((current) => current ?? []);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 120_000);
    const onSent = () => void refresh();
    window.addEventListener("criclume:reminders", onSent);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("criclume:reminders", onSent);
    };
  }, [refresh]);
  const unread = (items ?? []).filter((item) => !item.read_at);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void refresh();
    if (!next && unread.length) void markRead(unread.map((item) => item.id)).then(refresh);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="app-icon-button relative"
          aria-label={unread.length ? `Reminders, ${unread.length} new` : "Reminders"}
        >
          {unread.length ? (
            <BellRing className="size-4" aria-hidden="true" />
          ) : (
            <Bell className="size-4" aria-hidden="true" />
          )}
          {unread.length > 0 && (
            <span className="reminder-badge">{unread.length > 9 ? "9+" : unread.length}</span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Reminders</SheetTitle>
          <SheetDescription>
            Availability, fees and umpiring jobs — in the app, on your phone, by email, WhatsApp or
            text.
          </SheetDescription>
        </SheetHeader>
        <div className="office-tabs mt-4" role="tablist" aria-label="Reminders">
          <button
            type="button"
            role="tab"
            className="office-tab"
            aria-selected={view === "inbox"}
            onClick={() => setView("inbox")}
          >
            Inbox {unread.length > 0 && `(${unread.length})`}
          </button>
          <button
            type="button"
            role="tab"
            className="office-tab"
            aria-selected={view === "settings"}
            onClick={() => setView("settings")}
          >
            How to reach me
          </button>
        </div>
        <div className="mt-4">
          {view === "inbox" ? (
            <Inbox items={items} onNavigate={() => onOpenChange(false)} />
          ) : (
            <ReachMe />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Inbox({ items, onNavigate }: { items: NotificationRow[] | null; onNavigate: () => void }) {
  if (!items)
    return (
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading…
      </p>
    );
  if (!items.length)
    return (
      <p className="office-meta rounded-xl border border-dashed border-border p-4 text-center">
        No reminders yet. You're all caught up.
      </p>
    );
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const message = reminderMessage(
          item.template,
          (item.payload ?? {}) as Record<string, unknown>,
          { timeZone: zone },
        );
        const deliveries = (item.deliveries ?? {}) as Record<string, string>;
        const via = (Object.keys(channelLabels) as ReminderChannel[]).filter(
          (channel) => deliveries[channel] === "sent",
        );
        return (
          <li key={item.id} className={`reminder-item ${item.read_at ? "" : "reminder-item-new"}`}>
            <Link
              to={(item.link ?? "/platform") as "/platform"}
              onClick={onNavigate}
              className="block"
            >
              <span className="flex items-start justify-between gap-2">
                <strong className="text-sm">{message.title}</strong>
                <span className="office-meta shrink-0 text-[11px]">{ago(item.created_at)}</span>
              </span>
              <span className="office-meta mt-1 block text-xs">{message.body}</span>
              {via.length > 0 && (
                <span className="office-meta mt-1 block text-[11px]">
                  Also sent by{" "}
                  {via.map((channel) => channelLabels[channel].toLowerCase()).join(", ")}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ReachMe() {
  const [prefs, setPrefs] = useState<ReminderPreferences | null>(null);
  const [phone, setPhone] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [devices, setDevices] = useState(0);
  const [thisDevice, setThisDevice] = useState<
    "checking" | "on" | "off" | "unsupported" | "preview" | "denied"
  >("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      loadPreferences(),
      reminderSetup().catch(() => null),
      countMyDevices().catch(() => 0),
    ]).then(([loaded, info, count]) => {
      setPrefs(loaded);
      setPhone(loaded.phone ?? "");
      setSetup(info);
      setDevices(count);
    });
    void (async () => {
      if (!browserServiceWorkerAllowed()) return setThisDevice("preview");
      if (!("PushManager" in window) || !("Notification" in window))
        return setThisDevice("unsupported");
      if (Notification.permission === "denied") return setThisDevice("denied");
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      setThisDevice(
        (await registration?.pushManager.getSubscription()) && Notification.permission === "granted"
          ? "on"
          : "off",
      );
    })();
  }, []);

  if (!prefs)
    return (
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading…
      </p>
    );
  const set = (patch: Partial<ReminderPreferences>) => setPrefs({ ...prefs, ...patch });

  async function turnOnHere() {
    if (!setup?.pushKey) return void toast.error("Phone alerts aren't available right now.");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setThisDevice(permission === "denied" ? "denied" : "off");
        return void toast.error("Allow notifications to get phone alerts.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toKey(setup.pushKey),
        }));
      await saveDevice(subscription.toJSON());
      setThisDevice("on");
      setDevices(await countMyDevices());
      toast.success("Phone alerts on for this device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not turn on phone alerts.");
    } finally {
      setBusy(false);
    }
  }
  async function turnOffHere() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await removeDevice(subscription.endpoint);
      setThisDevice("off");
      setDevices(await countMyDevices());
      toast.success("Phone alerts off for this device.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const typed = phone.trim();
    const number = typed ? normalisePhone(typed) : null;
    if (typed && !number)
      return void toast.error("Write the number with the country code, e.g. +92 300 1234567.");
    if ((prefs!.whatsapp || prefs!.sms) && !number)
      return void toast.error("Add your mobile number for WhatsApp or texts.");
    setBusy(true);
    try {
      await savePreferences({ ...prefs!, phone: number });
      setPhone(number ?? "");
      toast.success("Saved. We'll reach you this way.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const deviceNote = {
    checking: "Checking this device…",
    on: "On for this device.",
    off: "Not on for this device yet.",
    unsupported:
      "This browser can't show alerts. On iPhone, add CricLume to your home screen first.",
    preview: "Phone alerts work on the published app (criclume.com).",
    denied: "Notifications are blocked for CricLume in this browser's settings.",
  }[thisDevice];

  return (
    <div className="space-y-4">
      <section className="office-card space-y-3">
        <h3>How to reach me</h3>
        <p className="office-meta">
          You always see reminders here in the app. Choose where else they go.
        </p>
        <Row
          label="Phone alerts"
          hint={`${deviceNote}${devices ? ` ${devices} device${devices === 1 ? "" : "s"} signed up.` : ""}`}
        >
          <Switch
            checked={prefs.push}
            onCheckedChange={(push) => set({ push })}
            aria-label="Phone alerts"
          />
        </Row>
        {prefs.push && (thisDevice === "off" || thisDevice === "on") && (
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void (thisDevice === "on" ? turnOffHere() : turnOnHere())}
          >
            {thisDevice === "on" ? "Turn off on this device" : "Turn on for this device"}
          </button>
        )}
        <Row
          label="Email"
          hint={
            setup && !setup.email
              ? "Email reminders start as soon as CricLume's sending address is switched on."
              : "Sent to the email you sign in with."
          }
        >
          <Switch
            checked={prefs.email}
            onCheckedChange={(email) => set({ email })}
            aria-label="Email"
          />
        </Row>
        <Row label="WhatsApp" hint="Clubs on a paid plan.">
          <Switch
            checked={prefs.whatsapp}
            onCheckedChange={(whatsapp) => set({ whatsapp })}
            aria-label="WhatsApp"
          />
        </Row>
        <Row label="Text message" hint="Clubs on a paid plan.">
          <Switch
            checked={prefs.sms}
            onCheckedChange={(sms) => set({ sms })}
            aria-label="Text message"
          />
        </Row>
        {(prefs.whatsapp || prefs.sms) && (
          <label className="block">
            <span className="office-label">Mobile number (with country code)</span>
            <input
              className="scorer-input w-full"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+92 300 1234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            {setup && !setup.texts && (
              <span className="office-meta mt-1 block text-xs">
                WhatsApp and texts start once CricLume's messaging account is connected.
              </span>
            )}
          </label>
        )}
      </section>
      <section className="office-card space-y-3">
        <h3>What to remind me about</h3>
        <Row
          label="Availability"
          hint="When you or your child haven't replied before the deadline."
        >
          <Switch
            checked={prefs.availability}
            onCheckedChange={(availability) => set({ availability })}
            aria-label="Availability"
          />
        </Row>
        <Row label="Fees" hint="Before a fee is due, then weekly while it's unpaid.">
          <Switch
            checked={prefs.fees}
            onCheckedChange={(fees) => set({ fees })}
            aria-label="Fees"
          />
        </Row>
        <Row
          label="Umpiring jobs"
          hint="Offers waiting for your answer, and the day before a match."
        >
          <Switch
            checked={prefs.umpire_jobs}
            onCheckedChange={(umpire_jobs) => set({ umpire_jobs })}
            aria-label="Umpiring jobs"
          />
        </Row>
      </section>
      <button
        type="button"
        className="action-primary w-full"
        disabled={busy}
        onClick={() => void save()}
      >
        Save
      </button>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        {hint && <p className="office-meta text-xs">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
