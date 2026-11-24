import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Megaphone, Plus, Search, Trash2 } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { can, type PlatformRole } from "@/lib/platform";
import { countryFlag } from "@/lib/live-centre";
import { Empty, OfficeCard, OfficeField, Pill, day } from "@/components/office/ui";

interface Post {
  id: string;
  organisation_id: string | null;
  kind: string;
  title: string;
  detail: string | null;
  poster_name: string;
  country_code: string | null;
  region: string | null;
  town: string | null;
  play_date: string | null;
  format: string | null;
  contact: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

const kinds = {
  players_wanted: "Players wanted",
  match_wanted: "Match wanted",
  player_available: "Available to play",
} as const;
type Kind = keyof typeof kinds;

/** Clubs looking for players or a fixture, and adult players looking for a game. Signed-in users only. */
export function LookingForBoard({
  organisationId,
  organisationName,
  role,
}: {
  organisationId: string;
  organisationName: string;
  role: PlatformRole;
}) {
  const db = getCloudClient();
  const manager = can(role, "events.manage");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ kind: string; country: string; town: string }>({
    kind: "",
    country: "",
    town: "",
  });
  const [form, setForm] = useState({
    kind: (manager ? "players_wanted" : "player_available") as Kind,
    title: "",
    detail: "",
    country: "",
    region: "",
    town: "",
    date: "",
    format: "",
    contact: "",
  });
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const { data: auth } = await db.auth.getUser();
    setMe(auth.user?.id ?? null);
    let q = db
      .from("board_posts")
      .select("*")
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString());
    if (filter.kind) q = q.eq("kind", filter.kind);
    if (filter.country) q = q.eq("country_code", filter.country.toUpperCase());
    if (filter.town.trim())
      q = q.ilike("town", `%${filter.town.trim().replace(/[\\%_]/g, "\\$&")}%`);
    const { data } = await q.order("created_at", { ascending: false }).limit(100);
    setPosts((data ?? []) as Post[]);
  }, [db, filter]);
  useEffect(() => void load(), [load]);

  const post = async () => {
    const club = form.kind !== "player_available";
    const { error } = await db.from("board_posts").insert({
      organisation_id: club ? organisationId : null,
      kind: form.kind,
      title: form.title.trim(),
      detail: form.detail.trim() || null,
      poster_name: club
        ? organisationName
        : (form.contact.trim().split("@")[0] || "Player").slice(0, 120),
      country_code: form.country.trim().toUpperCase() || null,
      region: form.region.trim() || null,
      town: form.town.trim() || null,
      play_date: form.date || null,
      format: form.format.trim() || null,
      contact: form.contact.trim() || null,
    });
    if (error) {
      toast.error(
        club && !manager
          ? "Only coaches and managers can post for the club."
          : "Your post could not be saved.",
      );
      return;
    }
    toast.success("Posted for 30 days");
    setOpen(false);
    setForm({ ...form, title: "", detail: "", date: "", contact: "" });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="panel-kicker">Looking for</p>
          <h2 className="text-2xl font-bold tracking-tight">Find players and fixtures</h2>
          <p className="office-meta">
            Short of players this weekend? Need a friendly? Posts last 30 days. Juniors can't post
            themselves.
          </p>
        </div>
        <button type="button" className="action-primary" onClick={() => setOpen(!open)}>
          <Plus className="size-4" /> New post
        </button>
      </div>
      {open && (
        <OfficeCard title="New post">
          <div className="grid gap-3 sm:grid-cols-3">
            <OfficeField label="Type">
              <select
                className="scorer-input"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
              >
                {(Object.keys(kinds) as Kind[])
                  .filter((k) => manager || k === "player_available")
                  .map((k) => (
                    <option key={k} value={k}>
                      {kinds[k]}
                      {k === "player_available" ? " (just me)" : ` (${organisationName})`}
                    </option>
                  ))}
              </select>
            </OfficeField>
            <OfficeField label="Headline" className="sm:col-span-2">
              <input
                className="scorer-input"
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={
                  form.kind === "match_wanted"
                    ? "2nd XI looking for a Sunday friendly"
                    : form.kind === "players_wanted"
                      ? "Need a keeper and a seamer for Saturday"
                      : "All-rounder free most Sundays"
                }
              />
            </OfficeField>
            <OfficeField label="Country code">
              <input
                className="scorer-input"
                maxLength={2}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                placeholder="GB"
              />
            </OfficeField>
            <OfficeField label="Region">
              <input
                className="scorer-input"
                maxLength={80}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </OfficeField>
            <OfficeField label="Town">
              <input
                className="scorer-input"
                maxLength={80}
                value={form.town}
                onChange={(e) => setForm({ ...form, town: e.target.value })}
              />
            </OfficeField>
            <OfficeField label="Date">
              <input
                type="date"
                className="scorer-input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </OfficeField>
            <OfficeField label="Format">
              <input
                className="scorer-input"
                maxLength={40}
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                placeholder="T20, 40 overs, tape-ball"
              />
            </OfficeField>
            <OfficeField label="How to get in touch">
              <input
                className="scorer-input"
                maxLength={200}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="Email or phone"
              />
            </OfficeField>
            <OfficeField label="Details" className="sm:col-span-3">
              <textarea
                className="scorer-input min-h-16"
                maxLength={1000}
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
            </OfficeField>
          </div>
          <p className="office-meta mt-2">
            Your contact details are shown to signed-in CricLume users.
          </p>
          <button
            type="button"
            className="action-primary mt-3"
            disabled={form.title.trim().length < 3}
            onClick={() => void post()}
          >
            <Megaphone className="size-4" /> Post
          </button>
        </OfficeCard>
      )}
      <div className="office-card grid gap-2 sm:grid-cols-3">
        <select
          className="scorer-input"
          value={filter.kind}
          onChange={(e) => setFilter({ ...filter, kind: e.target.value })}
          aria-label="Type"
        >
          <option value="">Everything</option>
          {(Object.keys(kinds) as Kind[]).map((k) => (
            <option key={k} value={k}>
              {kinds[k]}
            </option>
          ))}
        </select>
        <input
          className="scorer-input"
          maxLength={2}
          placeholder="Country code"
          value={filter.country}
          onChange={(e) => setFilter({ ...filter, country: e.target.value.toUpperCase() })}
          aria-label="Country"
        />
        <label className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="scorer-input pl-9"
            placeholder="Town"
            value={filter.town}
            onChange={(e) => setFilter({ ...filter, town: e.target.value })}
            aria-label="Town"
          />
        </label>
      </div>
      {posts === null ? (
        <p className="office-meta">Loading…</p>
      ) : posts.length === 0 ? (
        <Empty>Nothing posted here yet.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((p) => (
            <OfficeCard
              key={p.id}
              title={p.title}
              description={`${p.poster_name}${p.town ? ` · ${p.town}` : ""}${p.country_code ? ` ${countryFlag(p.country_code)}` : ""}`}
              action={
                <Pill tone={p.kind === "player_available" ? "good" : "warn"}>
                  {kinds[p.kind as Kind] ?? p.kind}
                </Pill>
              }
            >
              {p.detail && <p className="office-meta whitespace-pre-wrap">{p.detail}</p>}
              <p className="mt-2 flex flex-wrap gap-3 text-xs">
                {p.play_date && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" /> {day(p.play_date)}
                  </span>
                )}
                {p.format && <span>{p.format}</span>}
                {p.contact && <span className="font-semibold">{p.contact}</span>}
              </p>
              {(p.created_by === me || (manager && p.organisation_id === organisationId)) && (
                <button
                  type="button"
                  className="app-chip-button mt-2"
                  onClick={() =>
                    void db
                      .from("board_posts")
                      .update({ status: "closed" })
                      .eq("id", p.id)
                      .then(() => load())
                  }
                >
                  <Trash2 className="size-3.5" /> Close post
                </button>
              )}
            </OfficeCard>
          ))}
        </div>
      )}
    </div>
  );
}
