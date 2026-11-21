import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import {
  commandReceiptLabel,
  type CameraCommandOutcome,
  type CameraCommandReason,
  type CameraRecordingAction,
} from "@/lib/camera-command-receipts";

type Device = { id: string; label: string };
type CommandRow = {
  id: string;
  device_id: string;
  action: CameraRecordingAction;
  created_at: string;
};
type ReceiptRow = {
  command_id: string;
  device_id: string;
  outcome: CameraCommandOutcome;
  reason_code: CameraCommandReason;
  reported_at: string;
};
type DeviceConfirmation = { command: CommandRow; receipt?: ReceiptRow };

export function CameraCommandConfirmations({
  roomId,
  devices,
  refreshKey,
}: {
  roomId: string;
  devices: Device[];
  refreshKey: number;
}) {
  const [latest, setLatest] = useState<Record<string, DeviceConfirmation>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const client = getCloudClient();
      const commands = await client
        .from("camera_recording_commands")
        .select("id,device_id,action,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      if (commands.error) throw commands.error;
      const rows = (commands.data ?? []) as CommandRow[];
      const receiptRows: ReceiptRow[] = [];
      if (rows.length > 0) {
        const receipts = await client
          .from("camera_command_receipts")
          .select("command_id,device_id,outcome,reason_code,reported_at")
          .in("command_id", rows.map((row) => row.id));
        if (receipts.error) throw receipts.error;
        receiptRows.push(...((receipts.data ?? []) as ReceiptRow[]));
      }
      const byCommand = new Map(receiptRows.map((receipt) => [receipt.command_id, receipt]));
      const next: Record<string, DeviceConfirmation> = {};
      for (const command of rows) {
        if (!next[command.device_id]) {
          const matching = byCommand.get(command.id);
          next[command.device_id] = {
            command,
            ...(matching ? { receipt: matching } : {}),
          };
        }
      }
      setLatest(next);
      setLastChecked(new Date().toISOString());
      setError("");
    } catch {
      setError("Camera acknowledgments are unavailable. Verify the CricLume backend migration.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, refreshKey]);

  return (
    <section
      aria-label="Camera recording command acknowledgments"
      className="mt-5 rounded-xl border border-white/10 bg-[#151b26] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Recording command acknowledgments</h2>
          <p className="mt-1 text-xs text-slate-400">
            Signed-in phones report command outcomes. Acknowledgment is not evidence that
            footage was saved or uploaded; check recordings separately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-3 text-xs"
        >
          <RefreshCw className="size-4" /> Check responses
        </button>
      </div>
      {loading && <p role="status" className="mt-3 text-xs text-slate-300">Checking camera responses…</p>}
      {error && <p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {devices.map((device) => {
          const status = latest[device.id];
          const receipt = status?.receipt;
          const response = status
            ? commandReceiptLabel(status.command.action, receipt?.outcome, receipt?.reason_code)
            : "No recent recording requests";
          const positive = receipt && [
            "started",
            "already_recording",
            "stopped",
            "already_stopped",
          ].includes(receipt.outcome);
          return (
            <div key={device.id} className="rounded-lg border border-white/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-white">
                {positive ? (
                  <CheckCircle2 className="size-4 text-emerald-300" />
                ) : receipt ? (
                  <ShieldAlert className="size-4 text-amber-300" />
                ) : (
                  <Clock3 className="size-4 text-slate-400" />
                )}
                <span>{device.label}</span>
              </div>
              <p className="mt-1 text-slate-300">{response}</p>
              {status && (
                <p className="mt-1 text-slate-500">
                  Last request: {status.command.action} ·{" "}
                  {new Date(status.command.created_at).toLocaleTimeString()}
                  {receipt ? " · Phone response: " +
                    new Date(receipt.reported_at).toLocaleTimeString() : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {lastChecked
          ? "Last checked " + new Date(lastChecked).toLocaleTimeString()
          : "No server confirmation yet"}
      </p>
    </section>
  );
}
