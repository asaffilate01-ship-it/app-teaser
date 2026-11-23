import { useState } from "react";
import { Copy, Radio } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { overlayUrl, presetForUpload, qualityPresets, streamPlatforms, type StreamPlatform } from "@/lib/stream-guide";

/** Step-by-step free streaming with OBS to YouTube, Facebook or TikTok, with the score overlay. */
export function StreamGuide({ slug, matchTitle }: { slug: string; matchTitle: string }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<StreamPlatform>("youtube");
  const [upload, setUpload] = useState("");
  const guide = streamPlatforms.find((item) => item.id === platform)!;
  const link = typeof window === "undefined" ? "" : overlayUrl(window.location.origin, slug, platform);
  const speed = Number(upload);
  const preset = upload.trim() && Number.isFinite(speed) ? presetForUpload(speed) : undefined;
  const copy = (text: string, what: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`))
      .catch(() => window.prompt(`Copy the ${what.toLowerCase()}`, text));

  return (
    <>
      <button type="button" className="action-secondary" onClick={() => setOpen(true)} title="Stream this match free to YouTube, Facebook or TikTok">
        Go live <Radio className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="stream-guide max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stream {matchTitle} live</DialogTitle>
            <DialogDescription>Free with OBS Studio on a laptop. The CricLume score sits on top of your camera picture.</DialogDescription>
          </DialogHeader>

          <div className="card-tabs" role="tablist" aria-label="Stream to" style={{ position: "static", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {streamPlatforms.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={platform === item.id} onClick={() => setPlatform(item.id)}>
                {item.name}
              </button>
            ))}
          </div>

          <ol className="install-steps mt-2">
            <li>
              <span>
                Install <strong>OBS Studio</strong> (free, from obsproject.com) on the laptop at the ground.
              </span>
            </li>
            <li>
              <span>
                In OBS: <strong>Settings → Video</strong>, set both resolutions to{" "}
                <strong>
                  {guide.canvas.width}×{guide.canvas.height}
                </strong>
                {guide.vertical ? " (portrait)" : ""}.
              </span>
            </li>
            <li>
              <span>
                Add your camera: <strong>Sources → + → Video Capture Device</strong> (a USB camera, a camcorder through a capture card, or a phone used as a webcam).
              </span>
            </li>
            <li>
              <span className="grid gap-2">
                <span>
                  Add the score: <strong>Sources → + → Browser</strong>, paste this link and set width {guide.canvas.width}, height {guide.canvas.height}. It's see-through, so only the score shows.
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-white/5 px-2 py-1.5 text-xs">{link}</code>
                  <button type="button" className="app-chip-button" onClick={() => copy(link, "Overlay link")}>
                    <Copy className="size-4" /> Copy
                  </button>
                </span>
              </span>
            </li>
            <li>
              <span>
                Get your stream key: {guide.keyWhere}
              </span>
            </li>
            <li>
              <span>
                In OBS: <strong>Settings → Stream</strong>, choose <strong>{guide.obsService}</strong> and paste the key. Never share the key — anyone with it can stream to your account.
              </span>
            </li>
            <li>
              <span>
                Press <strong>Start Streaming</strong>, then score as usual. The score on the stream updates every few seconds.
              </span>
            </li>
          </ol>
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">{guide.note}</p>

          <div className="grid gap-2 border-t border-white/10 pt-3">
            <label className="grid gap-1 text-xs font-semibold">
              Upload speed at the ground (Mbps — run a speed test on the same internet)
              <input className="scorer-input h-10 max-w-40" inputMode="decimal" value={upload} onChange={(event) => setUpload(event.target.value)} placeholder="e.g. 8" />
            </label>
            {preset === null && <p className="text-sm text-rose-300">Too slow for a steady stream. Try a 4G/5G hotspot or move closer to the router; you need at least {qualityPresets[0].minUploadMbps} Mbps.</p>}
            {preset && (
              <p className="text-sm">
                Stream at <strong>{preset.label}</strong>: in OBS <strong>Settings → Output</strong>, set Video Bitrate to <strong>{preset.bitrateKbps} Kbps</strong>.
              </p>
            )}
            <p className="text-xs text-muted-foreground">If the internet drops, scoring carries on and saves on the phone; restart the stream in OBS when it is back.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
