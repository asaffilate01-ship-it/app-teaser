import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BatteryCharging,
  Camera,
  Check,
  CircleStop,
  CloudUpload,
  Radio,
  ShieldCheck,
  Smartphone,
  Video,
} from "lucide-react";
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";
import { useCloudSession } from "@/hooks/use-cloud-session";
import {
  getCloudClient,
  invokePlatformFunction,
  joinCameraPresence,
  uploadVideoResumably,
  type CameraPresence,
} from "@/lib/cloud";

export const Route = createFileRoute("/camera/$roomId")({
  head: () => ({
    meta: [
      { title: "CricLume match camera" },
      {
        name: "description",
        content: "Pair a phone with a CricLume match camera room and record a synchronized angle.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MatchCamera,
});

type CameraAngle = "pavilion_end" | "far_end" | "off_side" | "leg_side" | "roaming" | "other";
interface PairedDevice {
  id: string;
  room_id: string;
  label: string;
  angle: CameraAngle;
  device_key: string;
}

function deviceKey(): string {
  const key = "criclume:camera-device-key";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function MatchCamera() {
  const { roomId } = Route.useParams();
  const { configured, session, loading, requestLink } = useCloudSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureStartedAtRef = useRef<string>("");
  const presenceRef = useRef<Awaited<ReturnType<typeof joinCameraPresence>> | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("My phone");
  const [angle, setAngle] = useState<CameraAngle>("pavilion_end");
  const [device, setDevice] = useState<PairedDevice | null>(null);
  const [devices, setDevices] = useState<CameraPresence[]>([]);
  const [recording, setRecording] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [includesJunior, setIncludesJunior] = useState(false);
  const [blurMode, setBlurMode] = useState<"none" | "faces" | "people">("none");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      presenceRef.current?.leave();
    },
    [],
  );

  const pair = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const { data, error } = await getCloudClient().rpc("pair_camera_device", {
      p_token: token.trim(),
      p_device_key: deviceKey(),
      p_label: label.trim(),
      p_angle: angle,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    const paired = data as PairedDevice;
    setDevice(paired);
    const presence: CameraPresence = {
      deviceId: paired.id,
      label: paired.label,
      angle: paired.angle,
      batteryPercent: 100,
      signal: "good",
      recording: false,
      clockOffsetMs: 0,
      lastSeenAt: new Date().toISOString(),
    };
    presenceRef.current = await joinCameraPresence(roomId, presence, setDevices, (command) => {
      if (command["type"] === "identify") setMessage("Director is identifying this angle.");
    });
    setMessage("Phone paired. Start the camera preview when positioned.");
  };

  const startPreview = async () => {
    setMessage(null);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: true,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setPreviewing(true);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !device) return;
    if (!consent) {
      setMessage("Confirm recording consent before capture starts.");
      return;
    }
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => void saveRecording(new Blob(chunksRef.current, { type: mimeType }));
    recorder.start(5_000);
    recorderRef.current = recorder;
    captureStartedAtRef.current = new Date().toISOString();
    setRecording(true);
    void updatePresence(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    void updatePresence(false);
  };

  const updatePresence = async (isRecording: boolean) => {
    if (!device || !presenceRef.current) return;
    await presenceRef.current.update({
      deviceId: device.id,
      label: device.label,
      angle: device.angle,
      batteryPercent: 100,
      signal: navigator.onLine ? "good" : "poor",
      recording: isRecording,
      clockOffsetMs: 0,
      lastSeenAt: new Date().toISOString(),
    });
  };

  const saveRecording = async (blob: Blob) => {
    if (!device || !session) return;
    setUploadProgress(0);
    setMessage("Preparing encrypted cloud upload…");
    try {
      const { data: room, error: roomError } = await getCloudClient()
        .from("camera_rooms")
        .select("id, matches!inner(owner_organisation_id)")
        .eq("id", roomId)
        .single();
      if (roomError) throw roomError;
      const match = room.matches as unknown as { owner_organisation_id: string };
      const retention = new Date(
        Date.now() + (includesJunior ? 90 : 365) * 86_400_000,
      ).toISOString();
      const { data: asset, error: assetError } = await getCloudClient()
        .from("video_assets")
        .insert({
          organisation_id: match.owner_organisation_id,
          room_id: roomId,
          device_id: device.id,
          content_type: blob.type,
          size_bytes: blob.size,
          started_at: captureStartedAtRef.current,
          ended_at: new Date().toISOString(),
          status: "uploading",
          recording_consent: "granted",
          publication_consent: "pending",
          includes_junior: includesJunior,
          blur_mode: blurMode,
          retention_expires_at: retention,
          created_by: session.user.id,
        })
        .select("id")
        .single();
      if (assetError) throw assetError;
      const path = await uploadVideoResumably({
        roomId,
        organisationId: match.owner_organisation_id,
        assetId: asset.id,
        file: blob,
        contentType: blob.type,
        onProgress: (uploaded, total) =>
          setUploadProgress(total ? Math.round((uploaded / total) * 100) : 0),
      });
      await getCloudClient()
        .from("video_assets")
        .update({ storage_path: path, status: "uploaded" })
        .eq("id", asset.id);
      setUploadProgress(100);
      setMessage("Upload verified. The cloud processing job has been requested.");
      try {
        await invokePlatformFunction("transcode-video", { assetId: asset.id });
      } catch {
        /* source remains safely uploaded */
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed; the recording remains in this browser session.",
      );
    }
  };

  if (!configured)
    return (
      <CameraMessage
        title="Camera cloud not configured"
        detail="Connect Supabase before pairing phones to a camera room."
      />
    );
  if (loading)
    return <CameraMessage title="Connecting…" detail="Checking the camera-room session." />;
  if (!session)
    return (
      <CameraLogin
        email={email}
        setEmail={setEmail}
        submit={() => void requestLink(email, `${window.location.origin}/camera/${roomId}`)}
      />
    );

  return (
    <div className="min-h-screen bg-[#0f0d17] text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/">
            <img src={logoAsset.url} alt="CricLume" className="h-9 w-auto" />
          </Link>
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            <Smartphone className="size-3.5 text-amber-300" />
            Match camera
          </span>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <div className="relative aspect-video bg-black">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {!previewing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                <Camera className="size-10" />
                <span className="mt-3 text-xs">Camera preview is off</span>
              </div>
            )}
            {recording && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-black uppercase">
                <span className="size-2 animate-pulse rounded-full bg-rose-500" />
                Recording
              </div>
            )}
          </div>
          <div className="p-4">
            {!device ? (
              <PairingForm
                token={token}
                setToken={setToken}
                label={label}
                setLabel={setLabel}
                angle={angle}
                setAngle={setAngle}
                pair={pair}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{device.label}</div>
                    <div className="text-[11px] capitalize text-slate-500">
                      {device.angle.replaceAll("_", " ")}
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-200">
                    <Check className="size-3.5" />
                    Paired
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!previewing ? (
                    <button
                      onClick={() => void startPreview()}
                      className="rounded-md bg-white px-4 py-2.5 text-xs font-bold text-[#160f18]"
                    >
                      Start preview
                    </button>
                  ) : !recording ? (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2.5 text-xs font-bold"
                    >
                      <Radio className="size-4" />
                      Record
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-xs font-bold text-[#160f18]"
                    >
                      <CircleStop className="size-4" />
                      Stop & upload
                    </button>
                  )}
                </div>
              </div>
            )}
            {message && (
              <div className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
                {message}
              </div>
            )}
            {uploadProgress !== null && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                  <span>Cloud upload</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="size-4 text-amber-300" />
              Capture safeguards
            </h2>
            <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-slate-300">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 accent-amber-300"
              />
              <span>I confirm the club has recorded permission to capture this match.</span>
            </label>
            <label className="mt-3 flex items-center gap-3 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includesJunior}
                onChange={(event) => setIncludesJunior(event.target.checked)}
                className="accent-amber-300"
              />
              This recording includes junior players
            </label>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Privacy processing
              <select
                value={blurMode}
                onChange={(event) => setBlurMode(event.target.value as typeof blurMode)}
                className="mt-2 w-full rounded-md border border-white/10 bg-[#191621] p-2.5 text-xs normal-case tracking-normal text-white"
              >
                <option value="none">No automatic blur</option>
                <option value="faces">Blur faces</option>
                <option value="people">Blur people</option>
              </select>
            </label>
          </section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Video className="size-4 text-amber-300" />
              Room devices <span className="ml-auto text-xs text-slate-500">{devices.length}</span>
            </h2>
            <div className="mt-3 space-y-2">
              {devices.length === 0 ? (
                <p className="text-xs text-slate-500">Pair this phone to join the room.</p>
              ) : (
                devices.map((item) => (
                  <div
                    key={item.deviceId}
                    className="flex items-center justify-between rounded-md border border-white/8 p-2.5"
                  >
                    <div>
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] capitalize text-slate-500">
                        {item.angle.replaceAll("_", " ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[10px] font-bold ${item.recording ? "text-rose-300" : "text-amber-200"}`}
                      >
                        {item.recording ? "Recording" : "Ready"}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-600">
                        <BatteryCharging className="size-3" />
                        {item.batteryPercent ?? "—"}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <div className="flex items-center gap-2 rounded-lg border border-white/8 p-3 text-[10px] text-slate-500">
            <CloudUpload className="size-4 text-amber-300" />
            Resumable upload retries safely when the connection drops.
          </div>
        </aside>
      </main>
    </div>
  );
}

function PairingForm({
  token,
  setToken,
  label,
  setLabel,
  angle,
  setAngle,
  pair,
}: {
  token: string;
  setToken: (value: string) => void;
  label: string;
  setLabel: (value: string) => void;
  angle: CameraAngle;
  setAngle: (value: CameraAngle) => void;
  pair: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={pair} className="space-y-3">
      <div className="text-sm font-bold">Pair this phone</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Pairing code"
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-xs outline-none"
        />
        <input
          required
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Phone label"
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-xs outline-none"
        />
        <select
          value={angle}
          onChange={(event) => setAngle(event.target.value as CameraAngle)}
          className="rounded-md border border-white/10 bg-[#191621] px-3 py-2.5 text-xs"
        >
          <option value="pavilion_end">Pavilion end</option>
          <option value="far_end">Far end</option>
          <option value="off_side">Off side</option>
          <option value="leg_side">Leg side</option>
          <option value="roaming">Roaming</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button className="rounded-md bg-gradient-to-r from-rose-500 to-amber-400 px-4 py-2.5 text-xs font-bold">
        Pair phone
      </button>
    </form>
  );
}

function CameraLogin({
  email,
  setEmail,
  submit,
}: {
  email: string;
  setEmail: (value: string) => void;
  submit: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0d17] px-4 text-white">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-6"
      >
        <Smartphone className="size-8 text-amber-300" />
        <h1 className="mt-4 text-2xl font-bold">Sign in to pair this phone</h1>
        <p className="mt-2 text-sm text-slate-400">
          Camera-room access is temporary and recorded in the match audit.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@club.org"
          className="mt-5 w-full rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm"
        />
        <button className="mt-3 w-full rounded-md bg-gradient-to-r from-rose-500 to-amber-400 px-4 py-3 text-sm font-bold">
          Email sign-in link
        </button>
      </form>
    </div>
  );
}

function CameraMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0d17] px-4 text-center text-white">
      <div>
        <Camera className="mx-auto size-8 text-amber-300" />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">{detail}</p>
        <Link
          to="/platform"
          className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-xs font-bold text-[#160f18]"
        >
          Open control centre
        </Link>
      </div>
    </div>
  );
}
