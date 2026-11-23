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
          client.from("camera_devices").select("id,label,angle").eq("room_id", roomId).is("removed_at", null),
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
        client.from("camera_devices").select("id,label,angle").eq("room_id", roomId).is("removed_at", null),
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
      <main className="scoreboard-stage flex min-h-screen items-center justify-center px-4 py-16">
        <div className="broadcast-panel w-full max-w-md p-6 md:p-8">
        <span className="hero-chip"><Video className="size-3.5" aria-hidden="true" /> Camera director</span>
        <h1 className="mt-4 font-display text-2xl font-bold">Private camera director</h1>
        <p className="scoreboard-muted mt-2 text-sm">Sign in with your club account to watch and control this match's cameras.</p>
        <form onSubmit={signIn} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Club email"
            aria-label="Club email"
            className="scorer-input min-w-0 flex-1"
          />
          <button className="action-primary min-h-12">Email me a link</button>
        </form>
        {message && <p role="status" className="hero-ribbon text-left">{message}</p>}
        </div>
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
      className="scoreboard-stage min-h-screen px-4 py-5 md:px-8 md:py-6"
    >
      <div className="mx-auto max-w-7xl">
        <Link
          to="/platform"
          search={{ section: "capture" }}
          className="app-chip-button"
        >
          <ArrowLeft className="size-4" /> Club workspace
        </Link>
        <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="panel-kicker inline-flex items-center gap-2">
              <Video className="size-4" aria-hidden="true" /> Private live director
            </span>
            <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">{room.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="hero-chip"><Camera className="size-3.5" aria-hidden="true" />{devices.length} angles</span>
              <span className="hero-chip">{armedDevices.length} armed</span>
              <span className={`hero-chip ${recordingCount > 0 ? "hero-chip-live" : ""}`}>
                {recordingCount > 0 && <span className="live-dot" aria-hidden="true" />}
                {recordingCount} recording
              </span>
              <span className="hero-chip">Room {room.status}</span>
            </div>
          </div>
          <button
            onClick={() => void refresh()}
            className="action-secondary min-h-11"
          >
            <RefreshCw className="size-4" /> Refresh devices
          </button>
        </header>

        <div className="director-toolbar mt-6">
          <div className="insights-toggle" role="group" aria-label="Camera layout">
          {(["one", "two", "four"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={view === mode ? "is-active" : ""}
            >
              {mode === "one" ? "Focus" : mode === "two" ? "2 cameras" : "Grid"}
            </button>
          ))}
          </div>
          <button
            disabled={busy || armedDevices.length === 0}
            onClick={() =>
              void command(
                "start",
                armedDevices.map((device) => device.id),
              )
            }
            className="action-primary min-h-11 sm:ml-auto"
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
            className="action-secondary min-h-11"
          >
            <CircleStop className="size-4" /> Stop recordings
          </button>
        </div>
        {message && (
          <p
            role="status"
            className="hero-ribbon mt-3 text-left"
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
                className={`camera-tile ${presence[device.id]?.recording ? "camera-tile-rec" : ""}`}
              >
                <div className="camera-tile-screen">
                  <DirectorVideo stream={stream} muted={soundDevice !== device.id} />
                  {!stream && (
                    <div className="scoreboard-muted absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
                      <Camera className="size-9 text-gold" aria-hidden="true" />
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
                        className="action-secondary min-h-9 text-xs"
                      >
                        <RefreshCw className="size-3.5" aria-hidden="true" /> Reconnect
                      </button>
                    </div>
                  )}
                  {stream && (
                    <span className="hero-chip hero-chip-live camera-tile-badge">
                      <span className="live-dot" aria-hidden="true" /> Live
                    </span>
                  )}
                  {presence[device.id]?.recording && (
                    <span className="hero-chip hero-chip-live camera-tile-badge camera-tile-badge-right">
                      <CircleStop className="size-3" aria-hidden="true" /> Rec
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <h2 className="font-display text-base font-bold">{device.label}</h2>
                    <p className="scoreboard-muted text-xs capitalize">
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
                      className="action-secondary min-h-9 text-xs"
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
                      className="action-secondary min-h-9 text-xs"
                      aria-label={"Focus camera " + device.label}
                    >
                      <Maximize2 className="size-4" />
                    </button>
                    {armed && (
                      <button
                        disabled={busy}
                        onClick={() => void command("start", [device.id])}
                        className="action-primary min-h-9 text-xs"
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
            className="action-secondary min-h-11"
          >
            <Cloud className="size-4" />
            {cloudRecordingOpen ? "Hide cloud recording" : "Server-side cloud recording"}
          </button>
          <button
            type="button"
            aria-expanded={reviewOpen}
            onClick={() => setReviewOpen((value) => !value)}
            className="action-secondary min-h-11"
          >
            <Video className="size-4" />
            {reviewOpen ? "Hide recorded replays" : "Review recorded match clips"}
          </button>
          <span className="scoreboard-muted text-xs">
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
          <div className="broadcast-panel scoreboard-muted mt-6 p-8 text-center text-sm">
            No paired cameras yet. Pair a phone through the club Capture dashboard, then enable its
            live share.
          </div>
        )}
        <p className="scoreboard-muted mt-6 flex max-w-4xl items-start gap-2 text-xs leading-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          Private club review only. Each phone must explicitly enable camera sharing and consent to
          recording. Auto-record requests work while that phone is online and its browser is
          running. This browser peer-to-peer preview requires approved TURN connectivity for
          reliable access across networks; it is not a public broadcast or a server-recorded match.
        </p>
        <p className="scoreboard-muted mt-3 flex items-center gap-2 text-xs">
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
    <main className="scoreboard-stage flex min-h-screen items-center justify-center px-5 text-center">
      <div className="broadcast-panel max-w-md p-8">
        <Camera className="mx-auto mb-4 size-10 text-gold" aria-hidden="true" />
        <p>{text}</p>
        <Link
          to="/platform"
          search={{ section: "capture" }}
          className="action-secondary mt-5"
        >
          Back to club workspace
        </Link>
      </div>
    </main>
  );
}
