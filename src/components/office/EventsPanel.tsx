import { useState, type FormEvent } from "react";
import { CalendarPlus } from "lucide-react";
import { can } from "@/lib/platform";
import { availabilitySummary, type Availability } from "@/lib/club-office";
import { office, type ClubEvent } from "@/lib/club-office-cloud";
import { Empty, OfficeCard, OfficeField, Pill, fromLocal, nameOfPlayer, upcoming, when, type OfficeProps } from "./ui";

const kinds = [
  ["match", "Match"],
  ["training", "Training / nets"],
  ["tournament", "Tournament"],
  ["social", "Social"],
  ["meeting", "Meeting"],
  ["other", "Other"],
] as const;

const answerLabels: Record<Availability, string> = { available: "Available", maybe: "Maybe", unavailable: "Can't make it" };

export function squadFor(event: ClubEvent, club: OfficeProps["club"]): string[] {
  if (event.team_id) {
    const team = club.teams.find((item) => item.id === event.team_id);
    if (team && team.playerIds.length) return team.playerIds;
  }
  return club.players.map((player) => player.id);
}

export function EventsPanel(props: OfficeProps) {
  const { data, club, role, organisationId, act } = props;
  const manager = can(role, "events.manage");
  const events = upcoming(data.events);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {manager && <NewEvent {...props} />}
      {events.length === 0 && <Empty>No upcoming events yet.{manager ? " Add the first one above." : ""}</Empty>}
      {events.map((event) => {
        const squad = squadFor(event, club);
        const answers = new Map<string, Availability>(
          data.availability.filter((row) => row.event_id === event.id).map((row) => [row.player_id, row.status as Availability]),
        );
        const summary = availabilitySummary(squad, answers);
        const mine = data.myPlayerIds.filter((id) => squad.includes(id) || !event.team_id);
        const team = club.teams.find((item) => item.id === event.team_id);
        return (
          <OfficeCard
            key={event.id}
            title={event.title}
            description={[when(event.starts_at), event.location, team?.name].filter(Boolean).join(" · ")}
            action={<Pill>{kinds.find(([value]) => value === event.kind)?.[1] ?? event.kind}</Pill>}
          >
            {event.notes && <p className="office-meta mb-3">{event.notes}</p>}
            {mine.length > 0 && (
              <div className="mb-3 space-y-2">
                {mine.map((playerId) => (
                  <div key={playerId} className="office-row">
                    <span className="font-bold">{nameOfPlayer(club, playerId)}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {(Object.keys(answerLabels) as Availability[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="office-choice"
                          aria-pressed={answers.get(playerId) === status}
                          disabled={!event.availability_open}
                          onClick={() =>
                            void act(() => office.answer({ organisationId, eventId: event.id, playerId, status }), "Answer saved")
                          }
                        >
                          {answerLabels[status]}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
                {!event.availability_open && <p className="office-meta">Answers are closed for this event.</p>}
              </div>
            )}
            {manager && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Pill tone="good">{summary.available} available</Pill>
                  <Pill tone="warn">{summary.maybe} maybe</Pill>
                  <Pill tone="bad">{summary.unavailable} can't</Pill>
                  <Pill>{summary.noReply.length} no reply</Pill>
                  <button type="button" className="app-chip-button" onClick={() => setOpen(open === event.id ? null : event.id)}>
                    {open === event.id ? "Hide answers" : "See answers"}
                  </button>
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => void act(() => office.updateEvent(event.id, { availability_open: !event.availability_open }))}
                  >
                    {event.availability_open ? "Close answers" : "Reopen answers"}
                  </button>
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => {
                      if (window.confirm(`Cancel "${event.title}"?`))
                        void act(() => office.updateEvent(event.id, { cancelled_at: new Date().toISOString() }), "Event cancelled");
                    }}
                  >
                    Cancel event
                  </button>
                </div>
                {open === event.id && (
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {squad.map((playerId) => {
                      const answer = answers.get(playerId);
                      return (
                        <div key={playerId} className="office-row">
                          <span>{nameOfPlayer(club, playerId)}</span>
                          {answer ? (
                            <Pill tone={answer === "available" ? "good" : answer === "maybe" ? "warn" : "bad"}>{answerLabels[answer]}</Pill>
                          ) : (
                            <Pill>No reply</Pill>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </OfficeCard>
        );
      })}
    </div>
  );
}

function NewEvent({ club, organisationId, act }: OfficeProps) {
  const [kind, setKind] = useState<string>("match");
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const start = fromLocal(startsAt);
    if (!start) return;
    const ok = await act(
      () =>
        office.createEvent({
          organisation_id: organisationId,
          kind,
          title: title.trim(),
          team_id: teamId || null,
          starts_at: start,
          ends_at: fromLocal(endsAt),
          location: location.trim() || null,
          notes: notes.trim() || null,
        }),
      "Event added — players and parents can now answer",
    );
    if (ok) {
      setTitle("");
      setNotes("");
    }
  };
  return (
    <OfficeCard title="Add an event" description="Matches, nets, tournaments, socials and meetings. Players and parents answer from their own login.">
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <OfficeField label="Type">
          <select className="scorer-input" value={kind} onChange={(event) => setKind(event.target.value)}>
            {kinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Title" className="lg:col-span-2">
          <input required maxLength={140} className="scorer-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="U13 v Riverside" />
        </OfficeField>
        <OfficeField label="Team">
          <select className="scorer-input" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">Whole club</option>
            {club.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Starts">
          <input required type="datetime-local" className="scorer-input" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </OfficeField>
        <OfficeField label="Ends (optional)">
          <input type="datetime-local" className="scorer-input" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </OfficeField>
        <OfficeField label="Where">
          <input maxLength={200} className="scorer-input" value={location} onChange={(event) => setLocation(event.target.value)} />
        </OfficeField>
        <OfficeField label="Notes" className="sm:col-span-2">
          <input maxLength={1000} className="scorer-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Whites, arrive 45 minutes early" />
        </OfficeField>
        <div className="flex items-end">
          <button className="action-primary w-full">
            <CalendarPlus className="size-4" /> Add event
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}
