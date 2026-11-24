import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoaderCircle, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDeviceLimit } from "@/hooks/use-device-limit";
import { deviceLimit } from "@/lib/device-limit";
import { listMyDevices, signOutDevice, type LoginDevice } from "@/lib/device-limit-cloud";

/** Runs the two-devices rule for this screen and tells the person when it signs a device out. */
export function DeviceLimitGuard({ session }: { session: Session | null }) {
  const { signedOutHere, pushedOut, dismissPushedOut } = useDeviceLimit(session);
  useEffect(() => {
    if (!signedOutHere) return;
    toast.warning("Signed out on this device", {
      id: "device-limit-out",
      duration: 15000,
      description: `Your login is now in use on ${deviceLimit} newer devices. Each person should use their own login; sign in again here to use this device instead.`,
    });
  }, [signedOutHere]);
  useEffect(() => {
    if (pushedOut < 1) return;
    toast(`Your oldest device was signed out`, {
      id: "device-limit-pushed",
      duration: 8000,
      description: `One login works on up to ${deviceLimit} devices at once. See them under Devices.`,
    });
    dismissPushedOut();
  }, [pushedOut, dismissPushedOut]);
  return null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Header button listing the devices signed in with this login, with a sign-out for each. */
export function DevicesButton() {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<LoginDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setError(null);
    try {
      setDevices(await listMyDevices());
    } catch {
      setError("Devices could not be loaded. Check your connection and try again.");
    }
  }, []);
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  const active = (devices ?? []).filter((device) => !device.revokedAt);
  const earlier = (devices ?? []).filter((device) => device.revokedAt).slice(0, 5);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          type="button"
          className="app-chip-button"
          aria-label="Signed-in devices"
          title="Signed-in devices"
        >
          <MonitorSmartphone className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Devices</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Signed-in devices</SheetTitle>
          <SheetDescription>
            One login works on up to {deviceLimit} phones or computers at once. Signing in on
            another signs out the oldest. Camera phones and ground screens don’t count.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {devices === null && !error && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading…
            </p>
          )}
          {active.map((device) => (
            <div key={device.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {device.label}
                    {device.thisDevice && (
                      <span className="ml-2 text-xs font-bold text-primary">This device</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed in {when(device.signedInAt)} · last used {when(device.lastSeenAt)}
                  </p>
                </div>
                {!device.thisDevice && (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busyId === device.id}
                    className="action-secondary shrink-0 px-3 py-1.5 text-xs"
                    onClick={async () => {
                      setBusyId(device.id);
                      try {
                        await signOutDevice(device.id);
                        toast.success(`${device.label} will be signed out next time it connects.`);
                        await refresh();
                      } catch {
                        toast.error("That device could not be signed out. Try again.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    Sign out
                  </Button>
                )}
              </div>
            </div>
          ))}
          {earlier.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Signed out
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {earlier.map((device) => (
                  <li key={device.id}>
                    {device.label} · {device.revokedAt ? when(device.revokedAt) : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
