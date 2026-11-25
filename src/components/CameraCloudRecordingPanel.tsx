import { useCallback, useEffect, useRef, useState } from "react";
import { cameraCloudControls, isCameraCloudState } from "@/lib/camera-cloud-status";
import { CameraImportApproval } from "@/components/CameraImportApproval";
import { cameraArchiveStatusLabel } from "@/lib/camera-archive-policy";
import { Cloud, CircleStop, RefreshCw, Radio, ShieldAlert } from "lucide-react";
import {
  cameraCloudLabel,
  cameraCloudStart,
  cameraCloudStatus,
  cameraCloudStop,
  type CameraCloudRecording,
} from "@/lib/camera-cloud";

interface Camera {
  id: string;
  label: string;
  angle: string;
}

type CloudPanelProps = {
  roomId: string;
  devices: Camera[];
  armedDeviceIds: string[];
};

export function CameraCloudRecordingPanel(props: CloudPanelProps) {
  const key = [props.roomId, ...props.devices.map((device) => device.id).sort()].join(":");
  return <ScopedCameraCloudRecordingPanel key={key} {...props} />;
}

function ScopedCameraCloudRecordingPanel({ roomId, devices, armedDeviceIds }: CloudPanelProps) {
  const [recordings, setRecordings] = useState<Record<string, CameraCloudRecording | null>>({});
  const [unavailable, setUnavailable] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const requestRef = useRef(0);
  const activeRef = useRef(true);
  const locks = useRef(new Set<string>());
  const ids = devices
    .map((device) => device.id)
    .sort()
    .join(",");

  const refresh = useCallback(async () => {
    if (!activeRef.current) return;
    const request = ++requestRef.current;
    setChecking(true);
    const deviceIds = ids.split(",").filter(Boolean);
    const results = await Promise.allSettled(
      deviceIds.map(async (deviceId) => {
        const response = await cameraCloudStatus(roomId, deviceId);
        if (
          !Array.isArray(response.recordings) ||
          response.recordings.some(
            (recording) =>
              !recording ||
              recording.device_id !== deviceId ||
              !isCameraCloudState(recording.state),
          )
        )
          throw new Error("Invalid recording status");
        return response.recordings[0] ?? null;
      }),
    );
    if (!activeRef.current || request !== requestRef.current) return;
    const next: Record<string, CameraCloudRecording | null> = {};
    const errors: Record<string, string> = {};
    for (let i = 0; i < results.length; i++) {
      const id = deviceIds[i]!;
      const result = results[i]!;
      if (result.status === "fulfilled") next[id] = result.value;
      else errors[id] = "Recording status unavailable. Last confirmed status may be stale.";
    }
    setRecordings((current) => ({ ...current, ...next }));
    setUnavailable(errors);
    setLastChecked(new Date().toISOString());
    setChecking(false);
  }, [ids, roomId]);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(onVisible, 30_000);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      activeRef.current = false;
      requestRef.current++;
      window.clearInterval(timer);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const verified = (deviceId: string) =>
    !checking && Object.hasOwn(recordings, deviceId) && !unavailable[deviceId];
  const run = async (deviceId: string, action: "start" | "stop") => {
    if (!devices.some((device) => device.id === deviceId) || locks.current.has(deviceId)) return;
    const controls = cameraCloudControls({
      armed: armedDeviceIds.includes(deviceId),
      verified: verified(deviceId),
      state: recordings[deviceId]?.state ?? null,
      busy: Boolean(busy[deviceId]),
    });
    if (action === "start" && !controls.canStart) return;
    if (action === "stop" && !controls.canStop) return;
    if (
      action === "start" &&
      !window.confirm(
        "Start a chargeable, private cloud recording of this camera? " +
          "The operator must have enabled cloud publishing and granted recording consent.",
      )
    )
      return;
    locks.current.add(deviceId);
    setBusy((current) => ({ ...current, [deviceId]: true }));
    try {
      if (action === "start") await cameraCloudStart(roomId, deviceId);
      else await cameraCloudStop(roomId, deviceId);
      await refresh();
    } catch {
      if (!activeRef.current) return;
      requestRef.current++;
      setChecking(false);
      setUnavailable((current) => ({
        ...current,
        [deviceId]: "Command outcome not confirmed. Check recording status before starting again.",
      }));
    } finally {
      locks.current.delete(deviceId);
      if (activeRef.current) setBusy((current) => ({ ...current, [deviceId]: false }));
    }
  };

  return (
    <section
      aria-label="Server-side cloud camera recording"
      className="mt-6 rounded-xl border border-white/10 bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-base font-bold">
            <Cloud className="size-5 text-amber-300" /> Server-side camera recording
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Real LiveKit Egress requests to an approved private storage bucket. Recording must be
            explicitly enabled by the operator and director. A provider-complete status does not
            certify that the archived video has been validated.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-3 text-xs"
          disabled={checking || Object.values(busy).some(Boolean)}
          onClick={() => void refresh()}
        >
          <RefreshCw className="size-4" /> {checking ? "Checking…" : "Check recording status"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {devices.map((device) => {
          const recording = recordings[device.id];
          const armed = armedDeviceIds.includes(device.id);
          const statusVerified = verified(device.id);
          const controls = cameraCloudControls({
            armed,
            verified: statusVerified,
            state: recording?.state ?? null,
            busy: Boolean(busy[device.id]),
          });
          return (
            <div key={device.id} className="rounded-lg border border-white/10 p-3">
              <p className="text-sm font-bold">{device.label}</p>
              <p className="mt-1 text-xs capitalize text-slate-400">
                {device.angle.replaceAll("_", " ")} · {armed ? "Consented/armed" : "Not armed"}
              </p>
              <p role="status" className="mt-2 text-xs text-amber-100">
                {recording
                  ? cameraCloudLabel(recording.state)
                  : statusVerified
                    ? "No recording reported"
                    : "Recording status not confirmed"}
                {!statusVerified && recording && " · Last known status"}
              </p>
              {recording?.state === "provider_completed" && (
                <p className="mt-2 rounded-md border border-amber-300/20 px-2 py-2 text-xs text-amber-100">
                  {cameraArchiveStatusLabel(recording.archive_check_status)}
                  {recording.archive_check_status === "object_confirmed" &&
                    recording.archive_object_bytes !== null &&
                    " · " + Math.round(recording.archive_object_bytes / 1024) + " KiB"}
                </p>
              )}
              {recording && (
                <CameraImportApproval
                  key={recording.id}
                  recording={recording}
                  onSubmitted={refresh}
                  statusVerified={statusVerified && !busy[device.id]}
                />
              )}
              {unavailable[device.id] && (
                <p role="alert" className="mt-2 flex items-start gap-2 text-xs text-rose-200">
                  <ShieldAlert className="size-4 shrink-0" />
                  {unavailable[device.id]}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!controls.canStart}
                  onClick={() => void run(device.id, "start")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-bold disabled:opacity-40"
                >
                  <Radio className="size-4" /> Start cloud archive
                </button>
                <button
                  type="button"
                  disabled={!controls.canStop}
                  onClick={() => void run(device.id, "stop")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-xs disabled:opacity-40"
                >
                  <CircleStop className="size-4" /> {statusVerified ? "Stop" : "Request stop"}
                </button>
              </div>
              {recording && (
                <p className="mt-2 text-[11px] text-slate-500">
                  {recording.start_source === "match_state"
                    ? "Automatically started by match"
                    : "Director-started recording"}{" "}
                  · {new Date(recording.created_at).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {lastChecked
          ? "Last recording status check: " + new Date(lastChecked).toLocaleTimeString()
          : "Checking provider configuration"}
        {" · "}Cloud output is withheld from public playback until the archive and safeguarding
        checks pass.
      </p>
    </section>
  );
}
