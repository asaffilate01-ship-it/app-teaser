import { useCallback, useEffect, useState } from "react";
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

export function CameraCloudRecordingPanel({
  roomId,
  devices,
  armedDeviceIds,
}: {
  roomId: string;
  devices: Camera[];
  armedDeviceIds: string[];
}) {
  const [recordings, setRecordings] = useState<Record<string, CameraCloudRecording | null>>({});
  const [unavailable, setUnavailable] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const ids = devices.map((device) => device.id).join(",");

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled(
      ids
        .split(",")
        .filter(Boolean)
        .map(async (deviceId) => ({
          deviceId,
          response: await cameraCloudStatus(roomId, deviceId),
        })),
    );
    const next: Record<string, CameraCloudRecording | null> = {};
    const errors: Record<string, string> = {};
    for (let i = 0; i < results.length; i++) {
      const id = ids.split(",")[i];
      if (!id) continue;
      const result = results[i];
      if (result?.status === "fulfilled") {
        next[id] = result.value.response.recordings[0] ?? null;
      } else {
        errors[id] = "Provider status unavailable; check backend activation.";
      }
    }
    setRecordings(next);
    setUnavailable(errors);
    setLastChecked(new Date().toISOString());
  }, [ids, roomId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const run = async (deviceId: string, action: "start" | "stop") => {
    if (busy[deviceId]) return;
    if (
      action === "start" &&
      !window.confirm(
        "Start a chargeable, private cloud recording of this camera? " +
          "The operator must have enabled cloud publishing and granted recording consent.",
      )
    )
      return;
    setBusy((current) => ({ ...current, [deviceId]: true }));
    try {
      if (action === "start") await cameraCloudStart(roomId, deviceId);
      else await cameraCloudStop(roomId, deviceId);
      await refresh();
    } catch (error) {
      setUnavailable((current) => ({
        ...current,
        [deviceId]: error instanceof Error ? error.message : "Cloud control failed.",
      }));
    } finally {
      setBusy((current) => ({ ...current, [deviceId]: false }));
    }
  };

  return (
    <section
      aria-label="Server-side cloud camera recording"
      className="mt-6 rounded-xl border border-white/10 bg-[#171d29] p-4"
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
          onClick={() => void refresh()}
        >
          <RefreshCw className="size-4" /> Check provider
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {devices.map((device) => {
          const recording = recordings[device.id];
          const active =
            recording?.state === "starting" ||
            recording?.state === "recording" ||
            recording?.state === "stopping";
          const armed = armedDeviceIds.includes(device.id);
          return (
            <div key={device.id} className="rounded-lg border border-white/10 p-3">
              <p className="text-sm font-bold">{device.label}</p>
              <p className="mt-1 text-xs capitalize text-slate-400">
                {device.angle.replaceAll("_", " ")} · {armed ? "Consented/armed" : "Not armed"}
              </p>
              <p role="status" className="mt-2 text-xs text-amber-100">
                {recording ? cameraCloudLabel(recording.state) : "No provider recording reported"}
              </p>
              {unavailable[device.id] && (
                <p role="alert" className="mt-2 flex items-start gap-2 text-xs text-rose-200">
                  <ShieldAlert className="size-4 shrink-0" />
                  {unavailable[device.id]}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!armed || active || busy[device.id]}
                  onClick={() => void run(device.id, "start")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-bold disabled:opacity-40"
                >
                  <Radio className="size-4" /> Start cloud archive
                </button>
                <button
                  type="button"
                  disabled={!active || recording?.state === "stopping" || busy[device.id]}
                  onClick={() => void run(device.id, "stop")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-xs disabled:opacity-40"
                >
                  <CircleStop className="size-4" /> Stop
                </button>
              </div>
              {recording && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Request: {new Date(recording.created_at).toLocaleString()} · Status checked via
                  server
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {lastChecked
          ? "Last provider status check: " + new Date(lastChecked).toLocaleTimeString()
          : "Checking provider configuration"}
        {" · "}Cloud output is withheld from public playback until the archive and safeguarding
        checks pass.
      </p>
    </section>
  );
}
