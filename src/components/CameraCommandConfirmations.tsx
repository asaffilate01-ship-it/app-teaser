import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import {
  commandReceiptLabel,
  commandMaxAgeMs,
  matchingCameraReceipt,
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

type ConfirmationProps = { roomId: string; devices: Device[]; refreshKey: number };

export function CameraCommandConfirmations(props: ConfirmationProps) {
  const key = [props.roomId, ...props.devices.map((device) => device.id).sort()].join(":");
  return <CameraCommandConfirmationsPanel key={key} {...props} />;
}

function CameraCommandConfirmationsPanel({ roomId, devices, refreshKey }: ConfirmationProps) {
  const [latest, setLatest] = useState<Record<string, DeviceConfirmation>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const requestRef = useRef(0);
  const activeRef = useRef(false);
  const ids = devices
    .map((device) => device.id)
    .sort()
    .join(",");
  const refresh = useCallback(async () => {
    if (!activeRef.current) return;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const client = getCloudClient();
      // A room-wide limit can hide quieter phones after other cameras send many commands.
      const rows = (
        await Promise.all(
          ids
            .split(",")
            .filter(Boolean)
            .map(async (deviceId) => {
              const result = await client
                .from("camera_recording_commands")
                .select("id,device_id,action,created_at")
                .eq("room_id", roomId)
                .eq("device_id", deviceId)
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .limit(1);
              if (result.error) throw result.error;
              return (result.data ?? []) as CommandRow[];
            }),
        )
      ).flat();
      const receiptRows: ReceiptRow[] = [];
      if (rows.length > 0) {
        const receipts = await client
          .from("camera_command_receipts")
          .select("command_id,device_id,outcome,reason_code,reported_at")
          .in(
            "command_id",
            rows.map((row) => row.id),
          );
        if (receipts.error) throw receipts.error;
        receiptRows.push(...((receipts.data ?? []) as ReceiptRow[]));
      }
      const next: Record<string, DeviceConfirmation> = {};
      for (const command of rows) {
        if (!next[command.device_id]) {
          const matching = matchingCameraReceipt(command, receiptRows);
          next[command.device_id] = {
            command,
            ...(matching ? { receipt: matching } : {}),
          };
        }
      }
      if (request !== requestRef.current) return;
      setLatest(next);
      setLastChecked(new Date().toISOString());
      setError("");
    } catch {
      if (request === requestRef.current)
        setError("Camera acknowledgments are unavailable. Displayed responses may be out of date.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [ids, roomId]);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    const request = requestRef;
    return () => {
      activeRef.current = false;
      request.current++;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [refresh, refreshKey]);

  return (
    <section aria-label="Camera recording command acknowledgments" className="broadcast-panel mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Recording command acknowledgments</h2>
          <p className="mt-1 text-xs text-slate-400">
            Signed-in phones report command outcomes. Acknowledgment is not evidence that footage
            was saved or uploaded; check recordings separately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="action-secondary min-h-11 text-xs"
        >
          <RefreshCw className="size-4" /> Check responses
        </button>
      </div>
      {loading && (
        <p role="status" className="mt-3 text-xs text-slate-300">
          Checking camera responses…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-amber-200">
          {error}
        </p>
      )}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {devices.map((device) => {
          const status = latest[device.id];
          const receipt = status?.receipt;
          const expired =
            status &&
            !receipt &&
            lastChecked &&
            Date.parse(lastChecked) - Date.parse(status.command.created_at) > commandMaxAgeMs;
          const response = expired
            ? "Command expired without a phone acknowledgment"
            : status
              ? commandReceiptLabel(status.command.action, receipt?.outcome, receipt?.reason_code)
              : lastChecked && !error
                ? "No recording requests reported"
                : "Camera responses not confirmed";
          const positive =
            receipt &&
            ["started", "already_recording", "stopped", "already_stopped"].includes(
              receipt.outcome,
            );
          return (
            <div key={device.id} className="rounded-lg border border-white/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-white">
                {positive && !error && !loading ? (
                  <CheckCircle2 className="size-4 text-emerald-300" />
                ) : receipt ? (
                  <ShieldAlert className="size-4 text-amber-300" />
                ) : (
                  <Clock3 className="size-4 text-slate-400" />
                )}
                <span>{device.label}</span>
              </div>
              <p className="mt-1 text-slate-300">
                {response}
                {error && status && " · Last known response"}
              </p>
              {status && (
                <p className="mt-1 text-slate-500">
                  Last request: {status.command.action} ·{" "}
                  {new Date(status.command.created_at).toLocaleTimeString()}
                  {receipt
                    ? " · Phone response: " + new Date(receipt.reported_at).toLocaleTimeString()
                    : ""}
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
