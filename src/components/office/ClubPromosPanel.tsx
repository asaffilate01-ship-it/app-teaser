import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { slotArtwork, type PromoSlot } from "@/lib/promo-targeting";
import { Empty, OfficeCard, OfficeField, Pill, type OfficeProps } from "./ui";

const managerRoles = new Set(["owner", "club_admin", "league_admin"]);
const allowedTypes: Record<string, "image" | "video"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/gif": "image",
  "image/webp": "image",
  "video/mp4": "video",
};

interface ClubPromo {
  id: string;
  sponsor: string;
  slot: PromoSlot;
  media_path: string;
  media_kind: string;
  duration_seconds: number;
  click_url: string | null;
  active: boolean;
}

/** The club's own sponsor adverts: they run on the club's screens whenever no paid CricLume advert is booked. */
export function ClubPromosPanel({
  organisationId,
  role,
}: Pick<OfficeProps, "organisationId" | "role">) {
  const allowed = managerRoles.has(role);
  const [rows, setRows] = useState<ClubPromo[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sponsor, setSponsor] = useState("");
  const [slot, setSlot] = useState<PromoSlot>("top");
  const [seconds, setSeconds] = useState(10);
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const reload = useCallback(async () => {
    const client = getCloudClient();
    const { data, error } = await client
      .from("club_promos")
      .select("id, sponsor, slot, media_path, media_kind, duration_seconds, click_url, active")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false });
    if (error) {
      setMessage("Your club adverts could not load. Try again shortly.");
      setRows([]);
      return;
    }
    const list = (data ?? []) as ClubPromo[];
    setRows(list);
    if (list.length) {
      const { data: signed } = await client.storage.from("club-promo-media").createSignedUrls(
        list.map((row) => row.media_path),
        3600,
      );
      const map: Record<string, string> = {};
      for (const item of signed ?? [])
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      setPreviews(map);
    }
  }, [organisationId]);

  useEffect(() => {
    if (allowed) void reload();
  }, [allowed, reload]);

  if (!allowed) return null;

  const add = async () => {
    setMessage(null);
    const kind = file ? allowedTypes[file.type] : undefined;
    if (!file || !kind) return setMessage("Choose a PNG, JPG, GIF, WebP image or an MP4 video.");
    if (file.size > 50 * 1024 * 1024) return setMessage("Files can be up to 50 MB.");
    if (!sponsor.trim()) return setMessage("Add the sponsor's name.");
    const url = link.trim();
    if (url && !/^https:\/\/\S{3,500}$/.test(url))
      return setMessage("Links must start with https://");
    setBusy(true);
    const client = getCloudClient();
    const extension =
      (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${organisationId}/${slot}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    try {
      const upload = await client.storage
        .from("club-promo-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;
      const { error } = await client.from("club_promos").insert({
        organisation_id: organisationId,
        sponsor: sponsor.trim().slice(0, 120),
        slot,
        media_path: path,
        media_kind: kind,
        duration_seconds: Math.max(3, Math.min(60, Math.round(seconds))),
        alt_text: `Advert: ${sponsor.trim()}`.slice(0, 200),
        click_url: url || null,
      });
      if (error) {
        await client.storage.from("club-promo-media").remove([path]);
        throw error;
      }
      setSponsor("");
      setLink("");
      setFile(null);
      setMessage("Club advert added.");
      await reload();
    } catch {
      setMessage("The advert could not be saved. Check the file and try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: ClubPromo) => {
    const { error } = await getCloudClient()
      .from("club_promos")
      .update({ active: !row.active })
      .eq("id", row.id);
    setMessage(
      error
        ? "That change could not be saved."
        : row.active
          ? "Advert paused."
          : "Advert running again.",
    );
    await reload();
  };

  const remove = async (row: ClubPromo) => {
    const client = getCloudClient();
    const { error } = await client.from("club_promos").delete().eq("id", row.id);
    if (!error) await client.storage.from("club-promo-media").remove([row.media_path]);
    setMessage(error ? "The advert could not be removed." : "Advert removed.");
    await reload();
  };

  return (
    <OfficeCard
      title="Your club adverts"
      description="Add your own sponsors' banners. They run on your big screen, public scoreboard and app whenever no paid CricLume advert is booked. You keep any money you agree with your sponsors; CricLume takes nothing and pays no share on these."
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <OfficeField label="Sponsor name">
          <input
            className="scorer-input"
            maxLength={120}
            placeholder="Riverside Motors"
            value={sponsor}
            onChange={(e) => setSponsor(e.target.value)}
          />
        </OfficeField>
        <OfficeField label="Banner">
          <select
            className="scorer-input"
            value={slot}
            onChange={(e) => setSlot(e.target.value === "side" ? "side" : "top")}
          >
            {(["top", "side"] as const).map((value) => (
              <option key={value} value={value}>
                {slotArtwork[value].label} ({slotArtwork[value].size})
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Image, GIF or MP4 (up to 50 MB)">
          <input
            className="scorer-input"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,video/mp4"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </OfficeField>
        <OfficeField label="Seconds on screen (images)">
          <input
            className="scorer-input"
            type="number"
            min={3}
            max={60}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value) || 10)}
          />
        </OfficeField>
        <OfficeField label="Link when tapped (optional)" className="sm:col-span-2">
          <input
            className="scorer-input"
            type="url"
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </OfficeField>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="action-primary" disabled={busy}>
            {busy && <LoaderCircle className="mr-1 inline size-4 animate-spin" />}Add advert
          </button>
          {message && (
            <p className="office-meta" role="status">
              {message}
            </p>
          )}
        </div>
      </form>

      <div className="mt-4">
        {!rows && (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        )}
        {rows && rows.length === 0 && (
          <Empty>
            No club adverts yet. Until you add some, empty banners show CricLume adverts.
          </Empty>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const preview = previews[row.media_path];
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <div className="h-12 w-24 flex-none overflow-hidden rounded-md border border-border bg-muted">
                    {preview &&
                      (row.media_kind === "video" ? (
                        <video
                          src={preview}
                          muted
                          playsInline
                          className="size-full object-contain"
                        />
                      ) : (
                        <img src={preview} alt="" className="size-full object-contain" />
                      ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row.sponsor}</p>
                    <p className="office-meta">
                      {slotArtwork[row.slot].label} ·{" "}
                      {row.media_kind === "video" ? "Video" : `${row.duration_seconds}s`}
                    </p>
                  </div>
                  <Pill tone={row.active ? "good" : undefined}>
                    {row.active ? "Running" : "Paused"}
                  </Pill>
                  <button
                    type="button"
                    className="action-secondary"
                    onClick={() => void toggle(row)}
                  >
                    {row.active ? "Pause" : "Run"}
                  </button>
                  <button
                    type="button"
                    className="action-secondary"
                    aria-label={`Remove ${row.sponsor}`}
                    onClick={() => void remove(row)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </OfficeCard>
  );
}
