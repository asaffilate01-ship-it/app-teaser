import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CircleStop,
  Maximize2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { CameraReplayLibrary } from "@/components/CameraReplayLibrary";
import { CameraCommandConfirmations } from "@/components/CameraCommandConfirmations";
import { CameraCloudRecordingPanel } from "@/components/CameraCloudRecordingPanel";
import { Cloud } from "lucide-react";
import { getCloudClient, isCloudConfigured, type CameraPresence } from "@/lib/cloud";
import {
  connectLiveCamera,
  type LiveCameraSession,
  type LiveConnectionState,
} from "@/lib/camera-live";

export const Route = createFileRoute("/director/$roomId")({
  head: () => ({
    meta: [
      { title: "CricLume | Live camera director" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CameraDirector,
});

interface RoomRecord {
  id: string;
  name: string;
  status: string;
  match_id: string;
}
interface DeviceRecord {
  id: string;
  label: string;
  angle: string;
}
interface RecordingArm {
  device_id: string;
  armed: boolean;
  consent_confirmed: boolean;
}
type ViewMode = "one" | "two" | "four";

function CameraDirector() {
  const { roomId } = Route.useParams();
  const { session, configured, loading, requestLink } = useCloudSession();
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [arms, setArms] = useState<RecordingArm[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [states, setStates] = useState<Record<string, LiveConnectionState>>({});
  const [presence, setPresence] = useState<Record<string, CameraPresence>>({});
  const [view, setView] = useState<ViewMode>("four");
  const [focus, setFocus] = useState<string | null>(null);
  const [soundDevice, setSoundDevice] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cloudRecordingOpen, setCloudRecordingOpen] = useState(false);
  const [commandRefreshKey, setCommandRefreshKey] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const liveRef = useRef<Map<string, LiveCameraSession>>(new Map());
  const connectingRef = useRef<Set<string>>(new Set());
  const activeRef = useRef(true);

  const connectDevice = useCallback(
    async (deviceId: string) => {
      if (liveRef.current.has(deviceId) || connectingRef.current.has(deviceId)) return;
      connectingRef.current.add(deviceId);
      try {
        const connection = await connectLiveCamera({
          roomId,
          cameraId: deviceId,
          identity: "director:" + crypto.randomUUID(),
          mode: "director",
          onReady: (from) => {
            if (from === deviceId) {
              void liveRef.current
                .get(deviceId)
                ?.watch(deviceId)
                .catch((error: unknown) => setMessage(String(error)));
            }
          },
          onStream: (from, stream) => {
            if (!activeRef.current || from !== deviceId) return;
            setStreams((current) => {
              const next = { ...current };
              if (stream) next[deviceId] = stream;
              else delete next[deviceId];
              return next;
            });
          },
          onStatus: (from, state) => {
            if (activeRef.current && from === deviceId) {
              setStates((current) => ({ ...current, [deviceId]: state }));
            }
          },
          onError: (error) => {
            if (activeRef.current) setMessage(error);
          },
        });
        if (!activeRef.current) {
          connection.close();
          return;
        }
        liveRef.current.set(deviceId, connection);
        await connection.watch(deviceId);
      } catch (error) {
        if (activeRef.current) {
          setMessage(error instanceof Error ? error.message : "Private camera stream failed.");
        }
      } finally {
        connectingRef.current.delete(deviceId);
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (!configured || !session) return;
    const client = getCloudClient();
    activeRef.current = true;
    let presenceChannel: ReturnType<typeof client.channel> | null = null;
    const load = async () => {
      try {
        const access = await client.rpc("can_direct_camera_room", { p_room_id: roomId });
        if (access.error) throw access.error;
        if (!activeRef.current) return;
        setAuthorised(access.data === true);
        if (access.data !== true) return;

        await client.realtime.setAuth();
        presenceChannel = client
          .channel("camera:" + roomId, { config: { private: true } })
          .on("presence", { event: "sync" }, () => {
            if (!activeRef.current || !presenceChannel) return;
            const members = Object.values(
              presenceChannel.presenceState(),
            ).flat() as unknown as CameraPresence[];
            setPresence(
              Object.fromEntries(
                members
                  .filter((member) => Boolean(member.deviceId))
                  .map((member) => [member.deviceId, member]),
              ),
            );
          })
          .subscribe();
        const [roomResult, deviceResult, armResult] = await Promise.all([
          client.from("camera_rooms").select("id,name,status,match_id").eq("id", roomId).single(),
          client.from("camera_devices").select("id,label,angle").eq("room_id", roomId),
          client
            .from("camera_recording_arms")
            .select("device_id,armed,consent_confirmed")
            .eq("room_id", roomId),
        ]);
        if (roomResult.error) throw roomResult.error;
        if (deviceResult.error) throw deviceResult.error;
        if (armResult.error) throw armResult.error;
        if (!activeRef.current) return;
        setRoom(roomResult.data as RoomRecord);
        const connectedDevices = (deviceResult.data ?? []) as DeviceRecord[];
        setDevices(connectedDevices);
        setArms((armResult.data ?? []) as RecordingArm[]);
        await Promise.allSettled(connectedDevices.map((device) => connectDevice(device.id)));
      } catch (error) {
        if (activeRef.current) {
          setMessage(error instanceof Error ? error.message : "Camera room failed to load.");
        }
      }
    };
    void load();
    return () => {
      activeRef.current = false;
      if (presenceChannel) void client.removeChannel(presenceChannel);
      for (const connection of liveRef.current.values()) connection.close();
      liveRef.current.clear();
    };
  }, [configured, roomId, session, connectDevice]);

  const refresh = async () => {
    setMessage("");
    try {
      const client = getCloudClient();
      const [deviceResult, armResult] = await Promise.all([
        client.from("camera_devices").select("id,label,angle").eq("room_id", roomId),
        client
          .from("camera_recording_arms")
          .select("device_id,armed,consent_confirmed")
          .eq("room_id", roomId),
      ]);
      if (deviceResult.error) throw deviceResult.error;
      if (armResult.error) throw armResult.error;
      const nextDevices = (deviceResult.data ?? []) as DeviceRecord[];
      setDevices(nextDevices);
      setArms((armResult.data ?? []) as RecordingArm[]);
      await Promise.allSettled(nextDevices.map((device) => connectDevice(device.id)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh cameras.");
    }
  };

  const command = async (action: "start" | "stop", deviceIds: string[]) => {
    if (!session || busy || deviceIds.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await getCloudClient()
        .from("camera_recording_commands")
        .insert(
          deviceIds.map((deviceId) => ({
            room_id: roomId,
            device_id: deviceId,
            action,
            source: "director",
            issued_by: session.user.id,
          })),
        );
      if (error) throw error;
      setCommandRefreshKey((value) => value + 1);
      setMessage(
        action === "start"
          ? "Recording request sent. Verify each phone reports Recording before relying on the footage."
          : "Stop request sent. Each connected phone uploads its captured recording.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Camera control was denied.");
    } finally {
      setBusy(false);
    }
  };

  if (!isCloudConfigured()) return <DirectorGate text="CricLume Cloud must be configured." />;
  if (loading) return <DirectorGate text="Checking camera director access…" />;
  if (!session) {
    const signIn = (event: FormEvent) => {
      event.preventDefault();
      void requestLink(email, window.location.href).catch(() =>
        setMessage("Could not send sign-in link."),
      );
    };
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-white">
        <h1 className="text-2xl font-bold">Private camera director</h1>
        <p className="mt-3 text-sm text-slate-300">Sign in using your authorised club account.</p>
        <form onSubmit={signIn} className="mt-5 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Club email"
            className="min-w-0 flex-1 rounded-md border border-white/20 bg-slate-900 p-3"
          />
          <button className="rounded-md bg-amber-300 px-4 font-bold text-black">Sign in</button>
        </form>
        {message && <p className="mt-3 text-sm text-amber-200">{message}</p>}
      </main>
    );
  }
  if (authorised === false)
    return <DirectorGate text="Your account is not authorised to direct this match's cameras." />;
  if (authorised === null || !room)
    return <DirectorGate text={message || "Loading private live camera feeds…"} />;

  const armedDevices = devices.filter((device) =>
    arms.some((arm) => arm.device_id === device.id && arm.armed && arm.consent_confirmed),
  );
  const recordingCount = devices.filter((device) => presence[device.id]?.recording).length;
  const displayed =
    view === "one"
      ? devices.filter((device) => device.id === (focus ?? devices[0]?.id))
      : devices.slice(0, view === "two" ? 2 : 8);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[#0e1017] px-4 py-6 text-white md:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <Link
          to="/platform"
          search={{ section: "capture" }}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="size-4" /> Club control centre
        </Link>
        <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Video className="size-4" /> Private live director
            </span>
            <h1 className="mt-2 text-2xl font-bold md:text-4xl">{room.name}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {devices.length} paired angles · {armedDevices.length} auto-record armed ·{" "}
              {recordingCount} reporting recording · room {room.status}
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-4 text-sm"
          >
            <RefreshCw className="size-4" /> Refresh devices
          </button>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["one", "two", "four"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={
                "min-h-11 rounded-md px-4 text-sm font-semibold " +
                (view === mode
                  ? "bg-amber-300 text-black"
                  : "border border-white/20 text-slate-300")
              }
            >
              {mode === "one" ? "Focus" : mode === "two" ? "2 cameras" : "Grid"}
            </button>
          ))}
          <button
            disabled={busy || armedDevices.length === 0}
            onClick={() =>
              void command(
                "start",
                armedDevices.map((device) => device.id),
              )
            }
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-bold disabled:opacity-50"
          >
            <Radio className="size-4" /> Record armed cameras
          </button>
          <button
            disabled={busy || devices.length === 0}
            onClick={() =>
              void command(
                "stop",
                devices.map((device) => device.id),
              )
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-4 text-sm font-bold disabled:opacity-50"
          >
            <CircleStop className="size-4" /> Stop recordings
          </button>
        </div>
        {message && (
          <p
            role="status"
            className="mt-3 rounded-md border border-amber-300/30 px-3 py-2 text-sm text-amber-200"
          >
            {message}
          </p>
        )}

        <CameraCommandConfirmations
          roomId={roomId}
          devices={devices}
          refreshKey={commandRefreshKey}
        />
        <div
          className={
            "mt-5 grid gap-4 " +
            (view === "one" ? "grid-cols-1" : view === "two" ? "md:grid-cols-2" : "md:grid-cols-2")
          }
        >
          {displayed.map((device) => {
            const stream = streams[device.id] ?? null;
            const armed = armedDevices.some((item) => item.id === device.id);
            return (
              <section
                key={device.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#161a25]"
              >
                <div className="relative aspect-video bg-black">
                  <DirectorVideo stream={stream} muted={soundDevice !== device.id} />
                  {!stream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
                      <Camera className="size-9" />
                      <span>
                        {states[device.id] === "failed"
                          ? "Live connection failed"
                          : "Waiting for private live camera…"}
                      </span>
                      <button
                        onClick={() =>
                          void (
                            liveRef.current.get(device.id)?.watch(device.id) ??
                            connectDevice(device.id)
                          ).catch((error: unknown) => setMessage(String(error)))
                        }
                        className="rounded-md border border-white/20 px-3 py-2 text-xs"
                      >
                        Reconnect
                      </button>
                    </div>
                  )}
                  {stream && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-rose-600/90 px-3 py-1 text-xs font-semibold">
                      <span className="size-2 rounded-full bg-white" /> LIVE
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <h2 className="text-sm font-bold">{device.label}</h2>
                    <p className="text-xs capitalize text-slate-400">
                      {device.angle.replaceAll("_", " ")} · {states[device.id] ?? "offline"}
                      {" · "}
                      {armed ? "Auto-record armed" : "Not armed"}
                      {" · "}
                      {presence[device.id]?.recording
                        ? "Phone reports REC"
                        : presence[device.id]
                          ? "Phone not recording"
                          : "Phone offline/unverified"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSoundDevice(soundDevice === device.id ? null : device.id)}
                      className="rounded-md border border-white/20 px-3 py-2 text-xs"
                      aria-label={
                        soundDevice === device.id ? "Mute this camera" : "Unmute this camera"
                      }
                    >
                      {soundDevice === device.id ? "Mute" : "Sound"}
                    </button>
                    <button
                      onClick={() => {
                        setFocus(device.id);
                        setView("one");
                      }}
                      className="rounded-md border border-white/20 px-3 py-2 text-xs"
                      aria-label={"Focus camera " + device.label}
                    >
                      <Maximize2 className="size-4" />
                    </button>
                    {armed && (
                      <button
                        disabled={busy}
                        onClick={() => void command("start", [device.id])}
                        className="rounded-md border border-rose-400/50 px-3 py-2 text-xs text-rose-200"
                      >
                        <Radio className="inline size-4" /> Record
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={cloudRecordingOpen}
            onClick={() => setCloudRecordingOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-300/40 px-4 text-sm font-semibold text-amber-200"
          >
            <Cloud className="size-4" />
            {cloudRecordingOpen ? "Hide cloud recording" : "Server-side cloud recording"}
          </button>
          <button
            type="button"
            aria-expanded={reviewOpen}
            onClick={() => setReviewOpen((value) => !value)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-300/40 px-4 text-sm font-semibold text-amber-200"
          >
            <Video className="size-4" />
            {reviewOpen ? "Hide recorded replays" : "Review recorded match clips"}
          </button>
          <span className="text-xs text-slate-400">
            Private, consented clips and estimated ball-by-ball cue points
          </span>
        </div>
        {cloudRecordingOpen && (
          <CameraCloudRecordingPanel
            roomId={roomId}
            devices={devices}
            armedDeviceIds={armedDevices.map((device) => device.id)}
          />
        )}
        {reviewOpen && (
          <CameraReplayLibrary roomId={roomId} matchId={room.match_id} devices={devices} />
        )}
        {devices.length === 0 && (
          <div className="mt-6 rounded-xl border border-white/15 p-8 text-center text-sm text-slate-300">
            No paired cameras yet. Pair a phone through the club Capture dashboard, then enable its
            live share.
          </div>
        )}
        <p className="mt-6 flex max-w-4xl items-start gap-2 text-xs leading-5 text-slate-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300" />
          Private club review only. Each phone must explicitly enable camera sharing and consent to
          recording. Auto-record requests work while that phone is online and its browser is
          running. This browser peer-to-peer preview requires approved TURN connectivity for
          reliable access across networks; it is not a public broadcast or a server-recorded match.
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Check className="size-4" /> Camera controls are checked and audited by the server.
        </p>
      </div>
    </main>
  );
}

function DirectorVideo({ stream, muted }: { stream: MediaStream | null; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      controls={false}
      className="h-full w-full object-contain"
    />
  );
}

function DirectorGate({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e1017] px-5 text-center text-slate-200">
      <div>
        <Camera className="mx-auto mb-4 size-10 text-amber-300" />
        <p>{text}</p>
        <Link
          to="/platform"
          search={{ section: "capture" }}
          className="mt-4 inline-block text-sm text-amber-300 underline"
        >
          Return to CricLume club dashboard
        </Link>
      </div>
    </main>
  );
}
