import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { CricketMatch } from "@/lib/cricket";
import { copyBackupMatches, maxBackupBytes, parseScorerBackup } from "@/lib/scorer-storage";

export function ScorerBackupImport({ onImport }: { onImport: (matches: CricketMatch[]) => void }) {
  const [preview, setPreview] = useState<CricketMatch[] | null>(null);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  const reset = () => {
    request.current += 1;
    setPreview(null);
    setFilename("");
    setError("");
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  const read = async (file: File | undefined) => {
    reset();
    setNotice("");
    if (!file) return;
    const current = ++request.current;
    setBusy(true);
    try {
      if (file.size > maxBackupBytes) throw new Error("Choose a backup smaller than 10 MB.");
      const raw = await file.text();
      if (current !== request.current) return;
      setPreview(parseScorerBackup(raw));
      setFilename(file.name);
      window.requestAnimationFrame(() => summary.current?.focus());
    } catch (reason) {
      if (current === request.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "The backup could not be read. Try selecting it again.",
        );
    } finally {
      if (current === request.current) setBusy(false);
    }
  };
  return (
    <section aria-label="Import scorer backup" className="space-y-3">
      <p id="backup-help" className="text-sm text-slate-300">
        Bring back matches from a CricLume backup file (.json, up to 10 MB). You’ll see what’s
        inside before anything is added, and your current matches stay as they are.
      </p>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-bold transition hover:bg-white/10 focus-within:ring-2 focus-within:ring-amber-300/60">
        <Upload className="size-4" aria-hidden="true" />
        {filename ? "Choose a different file" : "Choose backup file"}
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-describedby={error ? "backup-help backup-error" : "backup-help"}
          aria-invalid={Boolean(error)}
          className="sr-only"
          onChange={(event) => void read(event.target.files?.[0])}
        />
      </label>
      {busy && <p role="status">Reading backup…</p>}
      {error && (
        <p id="backup-error" role="alert" className="text-amber-200">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-200">
          {notice}
        </p>
      )}
      {preview && (
        <div
          ref={summary}
          tabIndex={-1}
          aria-label="Backup preview"
          className="space-y-3 rounded-xl border border-amber-300/30 p-4"
        >
          <p className="break-words font-semibold">
            {filename} · {preview.length} {preview.length === 1 ? "match" : "matches"}
          </p>
          <ul className="max-h-64 overflow-y-auto space-y-2 text-sm" aria-label="Matches in backup">
            {preview.map((match) => (
              <li key={match.id} className="break-words">
                {match.teams[0].name} v {match.teams[1].name} · {match.innings.length} innings ·{" "}
                {match.innings.reduce((total, innings) => total + innings.deliveries.length, 0)}{" "}
                deliveries · {match.status.replaceAll("-", " ")}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-300">
            Imported matches receive new IDs. Re-importing creates additional copies. Device saving
            is subject to the storage status shown above.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="action-primary"
              onClick={() => {
                try {
                  onImport(copyBackupMatches(preview));
                  const count = preview.length;
                  reset();
                  setNotice(
                    `${count} local ${count === 1 ? "copy added" : "copies added"}. Check device saving status before closing this page.`,
                  );
                  input.current?.focus();
                } catch {
                  setError(
                    "The backup could not be imported. Existing matches are unchanged; try again.",
                  );
                }
              }}
            >
              Import {preview.length} local {preview.length === 1 ? "copy" : "copies"}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-white/20 px-4"
              onClick={() => {
                reset();
                input.current?.focus();
              }}
            >
              Cancel import
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
