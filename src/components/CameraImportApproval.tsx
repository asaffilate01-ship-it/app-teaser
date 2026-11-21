import { useState } from "react";
import { ShieldCheck, CloudUpload } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { cloudImportReviewLabel, type CloudImportState } from "@/lib/camera-import-policy";
import type { CameraCloudRecording } from "@/lib/camera-cloud";

export function CameraImportApproval({
  recording,
  onSubmitted,
}: {
  recording: CameraCloudRecording;
  onSubmitted: () => Promise<void>;
}) {
  const [recordingPermission, setRecordingPermission] = useState(false);
  const [includesJunior, setIncludesJunior] = useState(true);
  const [guardianPermission, setGuardianPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const raw = recording.camera_cloud_import_jobs;
  const job = Array.isArray(raw) ? raw[0] : raw;
  if (job && ["approved", "importing", "imported", "manual_review"].includes(job.state)) {
    return (
      <div className="mt-3 rounded-md border border-white/15 px-3 py-2 text-xs text-slate-300">
        <p>{cloudImportReviewLabel(job.state as CloudImportState)}</p>
        {job.state === "manual_review" && (
          <p className="mt-1 text-amber-200">
            Import needs a separate review or transfer service. Do not assume footage is saved.
          </p>
        )}
      </div>
    );
  }
  if (
    recording.state !== "provider_completed" ||
    recording.archive_check_status !== "object_confirmed"
  )
    return null;

  const submit = async () => {
    if (!recordingPermission || (includesJunior && !guardianPermission) || busy) return;
    if (
      !window.confirm(
        "Approve a private transfer of this confirmed recording? " +
          "It will not be public or playable until privacy processing is approved.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data, error: requestError } = await getCloudClient().functions.invoke(
        "camera-cloud-import-request",
        {
          body: {
            recordingId: recording.id,
            recordingPermissionAttested: true,
            includesJunior,
            guardianPermissionAttested: guardianPermission,
          },
        },
      );
      if (requestError || data?.error || data?.state !== "approved") {
        throw new Error("Private media approval was denied or is not configured.");
      }
      setSuccess("Private import approved and queued. This is not a completed transfer.");
      await onSubmitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Private import approval failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-300/20 p-3">
      <p className="inline-flex items-center gap-2 text-xs font-bold text-amber-200">
        <ShieldCheck className="size-4" /> Restricted media review
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        Club owner or safeguarding officer only. Confirm permission before the source is copied
        privately. All footage requires privacy processing, even if only adults are present.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          className="mt-0.5 accent-amber-300"
          checked={recordingPermission}
          onChange={(event) => setRecordingPermission(event.target.checked)}
        />
        I have verified club recording permission for this footage.
      </label>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          className="mt-0.5 accent-amber-300"
          checked={includesJunior}
          onChange={(event) => setIncludesJunior(event.target.checked)}
        />
        Footage includes junior players or their ages are uncertain
      </label>
      {includesJunior && (
        <label className="mt-3 flex items-start gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            className="mt-0.5 accent-amber-300"
            checked={guardianPermission}
            onChange={(event) => setGuardianPermission(event.target.checked)}
          />
          I have verified the required guardian recording permission.
        </label>
      )}
      <button
        type="button"
        disabled={busy || !recordingPermission || (includesJunior && !guardianPermission)}
        onClick={() => void submit()}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-3 text-xs font-bold text-black disabled:opacity-40"
      >
        <CloudUpload className="size-4" /> {busy ? "Submitting review…" : "Approve private import"}
      </button>
      {success && (
        <p role="status" className="mt-2 text-xs text-emerald-200">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
