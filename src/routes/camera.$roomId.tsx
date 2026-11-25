import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lockDarkWhileMounted } from "@/lib/theme";
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
import logoAsset from "@/assets/criclume-logo-on-dark.png.asset.json";
import { connectLiveCamera, type LiveCameraSession } from "@/lib/camera-live";
import {
  cameraCloudStop,
  publishCameraToCloud,
  type CameraCloudPublisher,
} from "@/lib/camera-cloud";
import { Cloud } from "lucide-react";
import {
  nextCameraCommand,
  reportCameraCommandResult,
  type CameraCommandCursor,
} from "@/lib/camera-command-receipts";
import { storageVideoMimeType } from "@/lib/camera-review";
import {
  cameraCaptureRates,
  reportedCaptureRate,
  speedCaptureProfile,
  type CameraCaptureRate,
} from "@/lib/ball-speed";
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

// Screen Wake Lock is opportunistic browser support, not native background capture.
type CameraWakeSentinel = {
  release: () => Promise<void>;
  addEventListener: (event: "release", listener: () => void) => void;
};
type WakeCapableNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<CameraWakeSentinel> };
};
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
  // Broadcast and camera screens always stay dark, whatever look the visitor picked.
  useEffect(() => lockDarkWhileMounted(), []);
  const { roomId } = Route.useParams();
  const { configured, session, loading, requestLink } = useCloudSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingRef = useRef(false);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const failedSegmentsRef = useRef<Array<{ blob: Blob; startedAt: string; endedAt: string }>>([]);
  const liveRef = useRef<LiveCameraSession | null>(null);
  const cloudPublisherRef = useRef<CameraCloudPublisher | null>(null);
  const commandHandlerRef = useRef<(command: Record<string, unknown>) => void>(() => {});
  const lastAppliedCommandRef = useRef<CameraCommandCursor | null>(null);
  const presenceHeartbeatRef = useRef<() => void>(() => {});
  const presenceRef = useRef<Awaited<ReturnType<typeof joinCameraPresence>> | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("My phone");
  const [angle, setAngle] = useState<CameraAngle>("pavilion_end");
  const [device, setDevice] = useState<PairedDevice | null>(null);
  const [devices, setDevices] = useState<CameraPresence[]>([]);
  const [recording, setRecording] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [captureRate, setCaptureRate] = useState<CameraCaptureRate>(30);
  const [actualCaptureRate, setActualCaptureRate] = useState<number | null>(null);
  const [openingPreview, setOpeningPreview] = useState(false);
  const previewRequest = useRef(0);
  const previewLock = useRef(false);
  const [wakeLockHeld, setWakeLockHeld] = useState(false);
  const [liveSharing, setLiveSharing] = useState(false);
  const [cloudPublishing, setCloudPublishing] = useState(false);
  const [cloudConnecting, setCloudConnecting] = useState(false);
  const [autoRecordArmed, setAutoRecordArmed] = useState(false);
  const [cloudAutoEnabled, setCloudAutoEnabled] = useState(false);
  const [cloudAutoBusy, setCloudAutoBusy] = useState(false);
  const [failedSegments, setFailedSegments] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  // Treat the age category as junior/uncertain until the operator explicitly confirms adult-only.
  const [includesJunior, setIncludesJunior] = useState(true);
  const [blurMode, setBlurMode] = useState<"none" | "faces" | "people">("none");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      previewRequest.current += 1;
      recordingRef.current = false;
      if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      liveRef.current?.close();
      void cloudPublisherRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      presenceRef.current?.leave();
    },
    [],
  );

  // Request a foreground screen wake lock when the operator starts a preview.
  // Screen lock, OS suspension and phone battery policy may still interrupt
  // web capture; only a tested native capture service could promise otherwise.
  useEffect(() => {
    if (!previewing) {
      setWakeLockHeld(false);
      return;
    }
    let cancelled = false;
    let held: CameraWakeSentinel | null = null;
    const requestWakeLock = async () => {
      if (cancelled || held || document.visibilityState !== "visible") return;
      const wakeLock = (navigator as WakeCapableNavigator).wakeLock;
      if (!wakeLock) return;
      try {
        const acquired = await wakeLock.request("screen");
        if (cancelled) {
          await acquired.release();
          return;
        }
        held = acquired;
        setWakeLockHeld(true);
        acquired.addEventListener("release", () => {
          if (held === acquired) held = null;
          if (!cancelled) setWakeLockHeld(false);
        });
      } catch {
        if (!cancelled) setWakeLockHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    void requestWakeLock();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void held?.release();
    };
  }, [previewing]);

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
    const { data: savedArm } = await getCloudClient()
      .from("camera_recording_arms")
      .select("armed")
      .eq("device_id", paired.id)
      .maybeSingle();
    setAutoRecordArmed(Boolean(savedArm?.armed));
    const { data: savedCloudOptIn } = await getCloudClient()
      .from("camera_cloud_auto_opt_ins")
      .select("enabled")
      .eq("device_id", paired.id)
      .maybeSingle();
    setCloudAutoEnabled(Boolean(savedCloudOptIn?.enabled));
    const presence: CameraPresence = {
      deviceId: paired.id,
      label: paired.label,
      angle: paired.angle,
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
    if (previewLock.current || streamRef.current?.active) return;
    const request = ++previewRequest.current;
    previewLock.current = true;
    setOpeningPreview(true);
    setActualCaptureRate(null);
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: speedCaptureProfile(captureRate),
        audio: true,
      });
      if (request !== previewRequest.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setActualCaptureRate(reportedCaptureRate(stream.getVideoTracks()[0]?.getSettings().frameRate));
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (streamRef.current !== stream) return;
          recordingRef.current = false;
          if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
          setRecording(false);
          setPreviewing(false);
          setActualCaptureRate(null);
          streamRef.current = null;
          stream.getTracks().forEach((item) => item.stop());
          liveRef.current?.close();
          setLiveSharing(false);
          void stopCloudPublisher();
          setMessage("Camera or microphone disconnected. Check that the saved clips uploaded.");
        });
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (request !== previewRequest.current) return;
      setPreviewing(true);
    } catch (error) {
      if (request !== previewRequest.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setActualCaptureRate(null);
      setMessage(error instanceof Error ? error.message : "Camera access was denied.");
    } finally {
      if (request === previewRequest.current) {
        previewLock.current = false;
        setOpeningPreview(false);
      }
    }
  };

  const setArmed = async (armed: boolean) => {
    if (!device || !session) return;
    if (armed && !consent) {
      setMessage("Confirm match recording permission before arming automatic capture.");
      return;
    }
    const { error } = await getCloudClient()
      .from("camera_recording_arms")
      .upsert(
        {
          device_id: device.id,
          room_id: roomId,
          user_id: session.user.id,
          armed,
          consent_confirmed: armed && consent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    if (error) {
      setMessage("Could not save auto-record preference: " + error.message);
    } else {
      setAutoRecordArmed(armed);
      setMessage(
        armed
          ? "Automatic recording armed. Keep this phone awake and its camera preview running."
          : "Automatic recording disarmed.",
      );
      if (!armed && recordingRef.current) stopRecording();
      if (!armed && cloudPublisherRef.current) void stopCloudPublisher();
      if (!armed && cloudAutoEnabled) void setCloudAutoEnabledByOperator(false);
    }
  };

  const startLiveSharing = async () => {
    if (!device || !streamRef.current || !consent) {
      setMessage("Camera preview and club permission are required before live sharing.");
      return;
    }
    try {
      const connection = await connectLiveCamera({
        roomId,
        identity: device.id,
        mode: "camera",
        stream: streamRef.current,
        onError: (error) => setMessage(error),
      });
      liveRef.current = connection;
      setLiveSharing(true);
      setMessage("Private live feed enabled for authorised match directors.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Private live share failed.");
    }
  };

  const stopLiveSharing = () => {
    liveRef.current?.close();
    liveRef.current = null;
    setLiveSharing(false);
    setMessage("Private live video sharing stopped.");
  };

  const startCloudPublisher = async () => {
    if (!device || !streamRef.current || !consent || !autoRecordArmed) {
      setMessage("Camera preview, permission and automatic recording arming are required.");
      return;
    }
    if (cloudPublisherRef.current || cloudConnecting) return;
    setCloudConnecting(true);
    try {
      const publisher = await publishCameraToCloud(roomId, device.id, streamRef.current, () => {
        cloudPublisherRef.current = null;
        setCloudPublishing(false);
        setMessage("Cloud camera connection lost. Confirm provider recording status.");
      });
      cloudPublisherRef.current = publisher;
      setCloudPublishing(true);
      setMessage(
        "Camera is publishing privately to LiveKit. A director must separately start cloud recording.",
      );
    } catch (error) {
      setCloudPublishing(false);
      setMessage(error instanceof Error ? error.message : "Private cloud publishing failed.");
    } finally {
      setCloudConnecting(false);
    }
  };

  const stopCloudPublisher = async () => {
    const publisher = cloudPublisherRef.current;
    cloudPublisherRef.current = null;
    setCloudPublishing(false);
    await publisher?.close();
    if (device) {
      try {
        await cameraCloudStop(roomId, device.id);
      } catch {
        // The phone stops its own media unconditionally. An authorised director
        // must verify and stop any lingering provider-side recording.
      }
    }
  };

  const setCloudAutoEnabledByOperator = async (enabled: boolean) => {
    if (!device || !session || cloudAutoBusy) return;
    if (enabled && (!consent || !autoRecordArmed || includesJunior)) {
      setMessage(
        "Automatic cloud recording is limited to confirmed adult-only matches with explicit camera permission.",
      );
      return;
    }
    setCloudAutoBusy(true);
    if (!enabled) {
      // Disconnect now, even if updating the preference fails.
      void stopCloudPublisher();
      setCloudAutoEnabled(false);
    }
    const { error } = await getCloudClient()
      .from("camera_cloud_auto_opt_ins")
      .upsert(
        {
          device_id: device.id,
          room_id: roomId,
          operator_id: session.user.id,
          enabled,
          adult_only_attested: enabled && !includesJunior,
          opted_in_at: enabled ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    if (error) {
      setMessage("Cloud opt-in could not be saved. Confirm that CricLume's backend is deployed.");
      // If the user cannot revoke the database preference, disarm the local
      // recording as a second, independent server-enforced safety condition.
      if (!enabled && autoRecordArmed) void setArmed(false);
    } else {
      setCloudAutoEnabled(enabled);
      setMessage(
        enabled
          ? "Adult-only auto-cloud recording enabled for this phone. Keep its cloud publisher connected. The director/platform must also authorise automatic starts."
          : "Automatic cloud recording disabled for this phone.",
      );
    }
    setCloudAutoBusy(false);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !device || recordingRef.current) return;
    if (!consent) {
      setMessage("Confirm match recording permission before capture starts.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setMessage("This browser does not support MediaRecorder. Use another camera device.");
      return;
    }
    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/webm",
      "video/mp4",
    ].find((format) => MediaRecorder.isTypeSupported(format));
    if (!mimeType) {
      setMessage("This device has no supported WebM or MP4 recording format.");
      return;
    }
    const beginSegment = () => {
      if (!recordingRef.current || !stream.active) return;
      try {
        const chunks: Blob[] = [];
        const startedAt = new Date().toISOString();
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
          const endedAt = new Date().toISOString();
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size > 0) {
            uploadQueueRef.current = uploadQueueRef.current
              .catch(() => {})
              .then(() => saveRecording(blob, startedAt, endedAt));
          }
          if (recordingRef.current && stream.active) beginSegment();
        };
        recorder.onerror = () => {
          recordingRef.current = false;
          setRecording(false);
          void updatePresence(false);
          setMessage("This recording segment failed. Check the camera and retained uploads.");
        };
        recorder.start(5_000);
        recorderRef.current = recorder;
        segmentTimerRef.current = setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 60_000);
      } catch (error) {
        recordingRef.current = false;
        setRecording(false);
        setMessage(
          error instanceof Error ? error.message : "Could not start this camera recording.",
        );
      }
    };
    recordingRef.current = true;
    setRecording(true);
    beginSegment();
    if (recordingRef.current) void updatePresence(true);
  };

  const stopRecording = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
    void updatePresence(false);
  };

  // The device records a single immutable, phone-reported outcome for each
  // recent command. This proves neither successful upload nor ongoing capture.
  commandHandlerRef.current = (payload) => {
    if (!device || !session) return;
    const next = nextCameraCommand(payload, device.id, lastAppliedCommandRef.current, Date.now());
    if (!next) return;
    lastAppliedCommandRef.current = next.cursor;

    const before = recordingRef.current;
    let captureThrew = false;
    try {
      if (next.command.action === "stop") {
        stopRecording();
      } else if (consent && autoRecordArmed && previewing) {
        startRecording();
      } else {
        setMessage("Recording request blocked: check consent, arming and camera preview.");
      }
    } catch {
      captureThrew = true;
      setMessage("Camera recorder failed to carry out the requested command.");
    }
    const result = captureThrew
      ? { outcome: "failed" as const, reason_code: "capture_failed" as const }
      : reportCameraCommandResult({
          action: next.command.action,
          before,
          after: recordingRef.current,
          consent,
          armed: autoRecordArmed,
          previewing,
        });

    void getCloudClient()
      .from("camera_command_receipts")
      .insert({
        command_id: next.command.id,
        room_id: roomId,
        device_id: device.id,
        reported_by: session.user.id,
        outcome: result.outcome,
        reason_code: result.reason_code,
      })
      .then(({ error }) => {
        if (error && error.code !== "23505") {
          setMessage("Recording status could not be confirmed to the director.");
        }
      });
  };

  // A realtime event can be missed while a phone changes networks or resumes.
  // Reconcile the newest authorised command on reconnect and while foregrounded.
  useEffect(() => {
    if (!device) return;
    const client = getCloudClient();
    let active = true;
    const reconcile = async () => {
      const result = await client
        .from("camera_recording_commands")
        .select("id,device_id,action,created_at")
        .eq("device_id", device.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (result.error) {
        setMessage("Camera command sync is unavailable. Check the recorder manually.");
      } else if (result.data) {
        commandHandlerRef.current(result.data as Record<string, unknown>);
      }
    };
    const channel = client
      .channel("camera:" + roomId, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "camera_recording_commands",
          filter: "device_id=eq." + device.id,
        },
        (payload) => commandHandlerRef.current(payload.new as Record<string, unknown>),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void reconcile();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setMessage("Camera command channel is offline; use local recording controls.");
        }
      });
    const onOnline = () => void reconcile();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reconcile();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void reconcile();
    }, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, [roomId, device]);

  presenceHeartbeatRef.current = () => {
    if (device && previewing) void updatePresence(recordingRef.current);
  };
  useEffect(() => {
    if (!device) return;
    const heartbeat = window.setInterval(() => presenceHeartbeatRef.current(), 15_000);
    return () => window.clearInterval(heartbeat);
  }, [device]);

  // If the camera is armed after the match started, make a single live-status
  // check when the preview becomes available. Do not restart after a manual stop.
  useEffect(() => {
    if (!device || !autoRecordArmed || !consent || !previewing) return;
    let active = true;
    void getCloudClient()
      .from("camera_rooms")
      .select("matches!inner(status)")
      .eq("id", roomId)
      .single()
      .then(({ data, error }) => {
        if (error || !active) return;
        const match = data?.matches as unknown as { status: string } | undefined;
        if (match?.status === "live" && !recordingRef.current) startRecording();
      });
    return () => {
      active = false;
    };
    // Only arming and camera availability should trigger this initial status check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, autoRecordArmed, consent, previewing, roomId]);

  const updatePresence = async (isRecording: boolean) => {
    if (!device || !presenceRef.current) return;
    await presenceRef.current.update({
      deviceId: device.id,
      label: device.label,
      angle: device.angle,
      signal: navigator.onLine ? "good" : "poor",
      recording: isRecording,
      clockOffsetMs: 0,
      lastSeenAt: new Date().toISOString(),
    });
  };

  const saveRecording = async (blob: Blob, startedAt: string, endedAt: string) => {
    if (!device || !session) return;
    setUploadProgress(0);
    setMessage("Preparing private cloud upload…");
    try {
      const storageContentType = storageVideoMimeType(blob.type);
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
          content_type: storageContentType,
          size_bytes: blob.size,
          started_at: startedAt,
          ended_at: endedAt,
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
        contentType: storageContentType,
        onProgress: (uploaded, total) =>
          setUploadProgress(total ? Math.round((uploaded / total) * 100) : 0),
      });
      const { error: saveError } = await getCloudClient().rpc("complete_camera_asset_upload", {
        p_asset_id: asset.id,
        p_storage_path: path,
      });
      if (saveError) throw saveError;
      setUploadProgress(100);
      setMessage("Upload saved. Requesting processing…");
      try {
        const job = await invokePlatformFunction<{ status: string }>("transcode-video", {
          assetId: asset.id,
        });
        setMessage(`Upload saved. Processing status: ${job.status}.`);
      } catch {
        setMessage(
          "Upload saved. Processing is unavailable; check the existing job before retrying.",
        );
      }
    } catch (error) {
      failedSegmentsRef.current.push({ blob, startedAt, endedAt });
      setFailedSegments(failedSegmentsRef.current.length);
      setMessage(
        (error instanceof Error ? error.message : "Upload failed.") +
          " Recording is still on this device. Download unsaved clips before closing the page.",
      );
    }
  };

  const downloadFailedSegments = () => {
    failedSegmentsRef.current.forEach((segment, index) => {
      const url = URL.createObjectURL(segment.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "criclume-" +
        roomId +
        "-" +
        segment.startedAt.replaceAll(":", "-") +
        "-" +
        index +
        (segment.blob.type.includes("mp4") ? ".mp4" : ".webm");
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    });
  };

  if (!configured)
    return (
      <CameraMessage
        title="Live cameras unavailable"
        detail="Live cameras aren't switched on for this club yet. Ask your club admin to finish setup."
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
    <div className="scoreboard-stage min-h-screen">
      <header className="scoreboard-topbar px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/">
            <img src={logoAsset.url} alt="CricLume" className="h-9 w-auto" />
          </Link>
          <span className={`hero-chip ${recording ? "hero-chip-live" : ""}`}>
            {recording ? (
              <span className="live-dot" aria-hidden="true" />
            ) : (
              <Smartphone className="size-3.5" aria-hidden="true" />
            )}
            {recording ? "Recording" : "Match camera"}
          </span>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid max-w-5xl gap-4 px-3 py-4 md:px-4 md:py-6 lg:grid-cols-[1.4fr_1fr]"
      >
        <section className={`camera-tile ${recording ? "camera-tile-rec" : ""}`}>
          <div className="camera-tile-screen">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {!previewing && (
              <div className="scoreboard-muted absolute inset-0 flex flex-col items-center justify-center">
                <Camera className="size-10 text-gold" aria-hidden="true" />
                <span className="mt-3 text-xs">Camera preview is off</span>
              </div>
            )}
            {recording && (
              <span className="hero-chip hero-chip-live camera-tile-badge">
                <span className="live-dot" aria-hidden="true" />
                Rec
              </span>
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
                    <div className="font-display text-lg font-bold">{device.label}</div>
                    <div className="scoreboard-muted text-[11px] capitalize">
                      {device.angle.replaceAll("_", " ")}
                    </div>
                  </div>
                  <span className="hero-chip">
                    <Check className="size-3.5" aria-hidden="true" />
                    Paired
                  </span>
                </div>
                {!previewing && (
                  <label className="grid gap-1 text-xs">
                    Camera capture mode
                    <select
                      className="scorer-input"
                      disabled={openingPreview}
                      value={captureRate}
                      onChange={(event) =>
                        setCaptureRate(Number(event.target.value) as CameraCaptureRate)
                      }
                    >
                      {cameraCaptureRates.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate === 30 ? "Standard match video" : "Experimental fast-ball capture"} ·{" "}
                          {rate} fps requested
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400">
                      Higher rates depend on the camera, browser, lighting and encoder. For speed
                      review, use a fixed side-on angle and verify the recorded clip timebase.
                    </span>
                  </label>
                )}
                {previewing && (
                  <p role="status" className="text-xs text-slate-300">
                    Camera track:{" "}
                    {actualCaptureRate === null
                      ? "frame rate not reported"
                      : `${actualCaptureRate} fps reported`}{" "}
                    · {captureRate} fps requested. Recorded and streamed frame rates may differ.
                  </p>
                )}
                <div>
                  {!previewing ? (
                    <button
                      disabled={openingPreview}
                      onClick={() => void startPreview()}
                      className="action-secondary min-h-14 w-full text-sm"
                    >
                      <Camera className="size-4" aria-hidden="true" />
                      {openingPreview ? "Opening camera…" : "Start preview"}
                    </button>
                  ) : !recording ? (
                    <button onClick={startRecording} className="wicket-bar">
                      <Radio className="size-5" aria-hidden="true" />
                      Record
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="action-secondary min-h-16 w-full text-base"
                    >
                      <CircleStop className="size-5" aria-hidden="true" />
                      Stop & upload
                    </button>
                  )}
                </div>
                <p role="status" className="text-xs leading-5 text-slate-400">
                  {previewing && wakeLockHeld
                    ? "Keep-awake protection active while this camera page stays foregrounded. Phone lock or OS suspension can still interrupt recording."
                    : "Keep this phone screen on and CricLume in the foreground during capture. Background or lock-screen recording is not certified for the web app."}
                </p>
                {previewing && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!consent || !autoRecordArmed || cloudConnecting}
                      onClick={() =>
                        void (cloudPublishing ? stopCloudPublisher() : startCloudPublisher())
                      }
                      className="action-secondary min-h-11 text-xs"
                    >
                      <Cloud className="size-4" />
                      {cloudConnecting
                        ? "Connecting cloud camera…"
                        : cloudPublishing
                          ? "Stop cloud publishing"
                          : "Publish to cloud recorder"}
                    </button>
                    <button
                      type="button"
                      onClick={() => (liveSharing ? stopLiveSharing() : void startLiveSharing())}
                      className={`${liveSharing ? "action-secondary" : "action-primary"} min-h-11 text-xs`}
                    >
                      {liveSharing ? "Stop private live share" : "Share live view with director"}
                    </button>
                    <span className="scoreboard-muted text-[11px]">
                      {liveSharing
                        ? "Private feed active"
                        : "Camera preview is local until sharing is enabled"}
                    </span>
                  </div>
                )}
              </div>
            )}
            {message && (
              <div role="status" className="hero-ribbon mt-3 text-left text-xs">
                {message}
              </div>
            )}
            {failedSegments > 0 && (
              <button
                type="button"
                onClick={downloadFailedSegments}
                className="action-secondary mt-3 min-h-10 text-xs"
              >
                Download {failedSegments} unsaved recording clip{failedSegments === 1 ? "" : "s"}
              </button>
            )}
            {uploadProgress !== null && (
              <div className="mt-3">
                <div className="scoreboard-muted mb-1 flex justify-between text-[10px]">
                  <span>Cloud upload</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="camera-progress">
                  <div className="camera-progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <section className="broadcast-panel">
            <h2 className="panel-kicker flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Capture safeguards
            </h2>
            <label className="mt-4 flex items-start gap-3 text-xs leading-5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  const granted = event.target.checked;
                  setConsent(granted);
                  if (!granted) {
                    // Revoking permission stops both capture and outgoing media immediately.
                    previewRequest.current += 1;
                    previewLock.current = false;
                    setOpeningPreview(false);
                    setActualCaptureRate(null);
                    stopRecording();
                    stopLiveSharing();
                    void stopCloudPublisher();
                    streamRef.current?.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                    if (videoRef.current) videoRef.current.srcObject = null;
                    setPreviewing(false);
                    if (cloudAutoEnabled) void setCloudAutoEnabledByOperator(false);
                    if (autoRecordArmed) void setArmed(false);
                    setMessage(
                      "Camera capture and live sharing stopped because permission was withdrawn.",
                    );
                  }
                }}
                className="mt-1 camera-check"
              />
              <span>I confirm the club has recorded permission to capture this match.</span>
            </label>
            <label className="mt-3 flex items-start gap-3 text-xs leading-5">
              <input
                type="checkbox"
                checked={autoRecordArmed}
                disabled={!device || !consent}
                onChange={(event) => void setArmed(event.target.checked)}
                className="mt-1 camera-check"
              />
              <span>
                Arm automatic recording when the match goes live, or when the authorised director
                requests it. This phone must stay on with its preview running.
              </span>
            </label>
            <label className="mt-4 flex items-start gap-3 text-xs leading-5">
              <input
                type="checkbox"
                checked={cloudAutoEnabled}
                disabled={
                  !device || !consent || !autoRecordArmed || includesJunior || cloudAutoBusy
                }
                onChange={(event) => void setCloudAutoEnabledByOperator(event.target.checked)}
                className="mt-1 camera-check"
              />
              <span>
                Opt in to <strong>server-side automatic cloud recording</strong> for an adult-only
                match when it goes live. By enabling this I confirm all recorded participants are
                adults and the club has authorised this camera's cloud recording. Publishing to
                LiveKit is a separate button; the platform's auto-cloud switch must also be enabled.
              </span>
            </label>
            <label className="mt-3 flex items-center gap-3 text-xs">
              <input
                type="checkbox"
                checked={includesJunior}
                disabled={recording}
                onChange={(event) => {
                  const junior = event.target.checked;
                  setIncludesJunior(junior);
                  if (junior && cloudAutoEnabled) {
                    void setCloudAutoEnabledByOperator(false);
                    if (autoRecordArmed) void setArmed(false);
                  }
                }}
                className="camera-check"
              />
              This recording includes junior players
            </label>
            <label className="scoreboard-muted mt-4 block text-[10px] font-bold uppercase tracking-wider">
              Privacy processing
              <select
                value={blurMode}
                disabled={recording}
                onChange={(event) => setBlurMode(event.target.value as typeof blurMode)}
                className="scorer-input mt-2 normal-case tracking-normal"
              >
                <option value="none">No automatic blur</option>
                <option value="faces">Blur faces</option>
                <option value="people">Blur people</option>
              </select>
            </label>
          </section>
          <section className="broadcast-panel">
            <h2 className="panel-kicker flex items-center gap-2">
              <Video className="size-4" aria-hidden="true" />
              Room devices <span className="hero-chip ml-auto">{devices.length}</span>
            </h2>
            <div className="mt-3 space-y-2">
              {devices.length === 0 ? (
                <p className="scoreboard-muted text-xs">Pair this phone to join the room.</p>
              ) : (
                devices.map((item) => (
                  <div key={item.deviceId} className="camera-device-row">
                    <div>
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="scoreboard-muted text-[10px] capitalize">
                        {item.angle.replaceAll("_", " ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider ${item.recording ? "scoreboard-wickets" : "text-gold"}`}
                      >
                        {item.recording ? "Recording" : "Ready"}
                      </div>
                      <div className="scoreboard-muted mt-1 flex items-center justify-end gap-1 text-[10px]">
                        <BatteryCharging className="size-3" />
                        {item.batteryPercent ?? "—"}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <div className="broadcast-panel scoreboard-muted flex items-center gap-2 text-[11px]">
            <CloudUpload className="size-4 shrink-0 text-gold" aria-hidden="true" />
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
      <div className="panel-kicker">Pair this phone</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Pairing code"
          className="scorer-input"
        />
        <input
          required
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Phone label"
          className="scorer-input"
        />
        <select
          value={angle}
          onChange={(event) => setAngle(event.target.value as CameraAngle)}
          className="scorer-input"
        >
          <option value="pavilion_end">Pavilion end</option>
          <option value="far_end">Far end</option>
          <option value="off_side">Off side</option>
          <option value="leg_side">Leg side</option>
          <option value="roaming">Roaming</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button className="action-primary min-h-12 w-full">Pair phone</button>
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
    <div className="scoreboard-stage flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="broadcast-panel w-full max-w-md p-6 md:p-8"
      >
        <span className="hero-chip">
          <Smartphone className="size-3.5" aria-hidden="true" /> Match camera
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Sign in to pair this phone</h1>
        <p className="scoreboard-muted mt-2 text-sm">
          Camera-room access is temporary and recorded in the match audit.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@club.org"
          aria-label="Email"
          className="scorer-input mt-5"
        />
        <button className="action-primary mt-3 min-h-12 w-full">Email sign-in link</button>
      </form>
    </div>
  );
}

function CameraMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="scoreboard-stage flex min-h-screen items-center justify-center px-4 text-center">
      <div className="broadcast-panel max-w-md p-8">
        <Camera className="mx-auto size-8 text-gold" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        <p className="scoreboard-muted mt-2 text-sm">{detail}</p>
        <Link to="/platform" className="action-secondary mt-6">
          Open club workspace
        </Link>
      </div>
    </div>
  );
}
