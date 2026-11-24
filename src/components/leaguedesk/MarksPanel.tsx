import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { Empty, OfficeCard, OfficeField, day } from "@/components/office/ui";
import { attempt, isLeagueAdmin, isTeamManager, must, type DeskProps } from "./shared";

interface Mark {
  id: string;
  fixture_id: string;
  team_id: string;
  umpire_marks: { umpireId?: string; name: string; mark: number }[];
  pitch_mark: number | null;
  outfield_mark: number | null;
  comments: string | null;
}

/** After a league match each side marks the umpires (1–5), the pitch and the outfield (1–6). */
export function MarksPanel(props: DeskProps) {
  const { club } = props;
  const db = getCloudClient();
  const league = isLeagueAdmin(props);
  const manager = isTeamManager(props);
  const [marks, setMarks] = useState<Mark[]>([]);
  const ownTeams = new Set(club.teams.filter((t) => !t.external).map((t) => t.id));
  const fixtures = club.fixtures
    .filter(
      (f) =>
        f.startsAt &&
        new Date(f.startsAt).getTime() < Date.now() &&
        (league || ownTeams.has(f.homeTeamId) || ownTeams.has(f.awayTeamId)),
    )
    .sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""))
    .slice(0, 30);
  const load = useCallback(async () => {
    if (!fixtures.length) return;
    const { data } = await db
      .from("fixture_marks")
      .select("*")
      .in(
        "fixture_id",
        fixtures.map((f) => f.id),
      );
    setMarks((data ?? []) as unknown as Mark[]);
  }, [db, fixtures.map((f) => f.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [load]);
  const teamName = (id: string) => club.teams.find((t) => t.id === id)?.name ?? "Team";

  if (league) {
    const byUmpire = new Map<string, number[]>();
    for (const m of marks)
      for (const u of m.umpire_marks)
        byUmpire.set(u.name, [...(byUmpire.get(u.name) ?? []), Number(u.mark)]);
    const pitch = marks.filter((m) => m.pitch_mark).map((m) => m.pitch_mark!);
    return (
      <div className="space-y-4">
        <OfficeCard title="Umpire marks" description="Average of captains' marks out of 5">
          {byUmpire.size === 0 ? (
            <Empty>No marks yet.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...byUmpire]
                .sort((a, b) => avg(b[1]) - avg(a[1]))
                .map(([name, list]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="tabular-nums">
                      {avg(list).toFixed(2)} · {list.length} marks
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </OfficeCard>
        <OfficeCard
          title="Pitches and outfields"
          description={
            pitch.length ? `Average pitch mark ${avg(pitch).toFixed(2)} / 6` : "No pitch marks yet"
          }
        >
          {marks.length === 0 ? (
            <Empty>No marks yet.</Empty>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {marks.map((m) => {
                const f = fixtures.find((x) => x.id === m.fixture_id);
                return (
                  <li key={m.id}>
                    {f
                      ? `${teamName(f.homeTeamId)} v ${teamName(f.awayTeamId)} · ${day(f.startsAt)}`
                      : "Fixture"}{" "}
                    — by {teamName(m.team_id)}: pitch {m.pitch_mark ?? "–"}/6, outfield{" "}
                    {m.outfield_mark ?? "–"}/6{m.comments ? ` · “${m.comments}”` : ""}
                  </li>
                );
              })}
            </ul>
          )}
        </OfficeCard>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {fixtures.length === 0 && <Empty>Your past league fixtures will appear here to mark.</Empty>}
      {fixtures.map((f) => {
        const teamId = ownTeams.has(f.homeTeamId) ? f.homeTeamId : f.awayTeamId;
        return (
          <FixtureMarks
            key={f.id}
            title={`${teamName(f.homeTeamId)} v ${teamName(f.awayTeamId)}`}
            date={f.startsAt}
            fixtureId={f.id}
            teamId={teamId}
            existing={marks.find((m) => m.fixture_id === f.id && m.team_id === teamId)}
            canEdit={manager}
            onSaved={load}
          />
        );
      })}
    </div>
  );
}

const avg = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);

function Stars({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <span className="inline-flex gap-0.5" role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of ${max}`}
          onClick={() => onChange(n)}
        >
          <Star
            className={`size-5 ${n <= value ? "fill-current text-gold" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </span>
  );
}

function FixtureMarks({
  title,
  date,
  fixtureId,
  teamId,
  existing,
  canEdit,
  onSaved,
}: {
  title: string;
  date: string | null;
  fixtureId: string;
  teamId: string;
  existing: Mark | undefined;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const db = getCloudClient();
  const [open, setOpen] = useState(false);
  const [umpires, setUmpires] = useState<{ umpireId?: string; name: string; mark: number }[]>(
    existing?.umpire_marks ?? [],
  );
  const [pitch, setPitch] = useState(existing?.pitch_mark ?? 0);
  const [outfield, setOutfield] = useState(existing?.outfield_mark ?? 0);
  const [comments, setComments] = useState(existing?.comments ?? "");
  useEffect(() => {
    if (!open || umpires.length) return;
    void db.rpc("fixture_umpires_for_marks", { p_fixture: fixtureId }).then(({ data }) => {
      const list = (data ?? []) as { umpire_id: string; display_name: string }[];
      setUmpires(
        list.length
          ? list.map((u) => ({ umpireId: u.umpire_id, name: u.display_name, mark: 0 }))
          : [
              { name: "", mark: 0 },
              { name: "", mark: 0 },
            ],
      );
    });
  }, [db, fixtureId, open, umpires.length]);
  const save = () =>
    attempt(
      () =>
        must(
          db.from("fixture_marks").upsert(
            {
              fixture_id: fixtureId,
              team_id: teamId,
              umpire_marks: umpires.filter((u) => u.name.trim() && u.mark > 0),
              pitch_mark: pitch || null,
              outfield_mark: outfield || null,
              comments: comments.trim() || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "fixture_id,team_id" },
          ),
        ),
      "Marks sent to the league",
      onSaved,
    );
  return (
    <OfficeCard
      title={title}
      description={`${day(date)}${existing ? " · marked" : ""}`}
      action={
        canEdit && (
          <button type="button" className="app-chip-button" onClick={() => setOpen(!open)}>
            {open ? "Hide" : existing ? "Change marks" : "Give marks"}
          </button>
        )
      }
    >
      {open && (
        <div className="space-y-3">
          {umpires.map((u, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="scorer-input w-48"
                placeholder={`Umpire ${i + 1}`}
                value={u.name}
                readOnly={Boolean(u.umpireId)}
                onChange={(e) =>
                  setUmpires(umpires.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <Stars
                value={u.mark}
                max={5}
                label={`Mark for ${u.name || `umpire ${i + 1}`}`}
                onChange={(v) =>
                  setUmpires(umpires.map((x, j) => (j === i ? { ...x, mark: v } : x)))
                }
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>Pitch</span>
            <Stars value={pitch} max={6} label="Pitch mark" onChange={setPitch} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>Outfield</span>
            <Stars value={outfield} max={6} label="Outfield mark" onChange={setOutfield} />
          </div>
          <OfficeField label="Comments for the league (not shown to umpires)">
            <textarea
              className="scorer-input min-h-16"
              maxLength={1500}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </OfficeField>
          <button type="button" className="action-primary" onClick={() => void save()}>
            Send marks
          </button>
        </div>
      )}
    </OfficeCard>
  );
}
