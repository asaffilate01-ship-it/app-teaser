import { useState, type FormEvent } from "react";
import { BellRing, CalendarCheck, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { can } from "@/lib/platform";
import {
  availabilitySummary,
  eventIcs,
  eventSquad,
  repliesClosed,
  type Availability,
} from "@/lib/club-office";
import { office, type ClubEvent } from "@/lib/club-office-cloud";
import { remindNow } from "./RemindersPanel";
import {
  Empty,
  OfficeCard,
  OfficeField,
  Pill,
  fromLocal,
  nameOfPlayer,
  upcoming,
  when,
  type OfficeProps,
} from "./ui";

const kinds = [
  ["match", "Match"],
  ["training", "Training / nets"],
  ["tournament", "Tournament"],
  ["social", "Social"],
  ["meeting", "Meeting"],
  ["other", "Other"],
] as const;

const answerLabels: Record<Availability, string> = {
  available: "Available",
  maybe: "Maybe",
  unavailable: "Can't make it",
  waitlist: "Waiting list",
};
const choices = ["available", "maybe", "unavailable"] as const;

function addToCalendar(event: ClubEvent) {
  const url = URL.createObjectURL(new Blob([eventIcs(event)], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^\w-]+/g, "-").slice(0, 60)}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function squadFor(event: ClubEvent, club: OfficeProps["club"]): string[] {
  return eventSquad(
    event.team_id,
    club.teams,
    club.players.map((player) => player.id),
  );
}

export function EventsPanel(props: OfficeProps) {
  const { data, club, role, organisationId, act } = props;
  const manager = can(role, "events.manage");
  const events = upcoming(data.events);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {manager && <NewEvent {...props} />}
      {events.length === 0 && (
        <Empty>No upcoming events yet.{manager ? " Add the first one above." : ""}</Empty>
      )}
      {events.map((event) => {
        const squad = squadFor(event, club);
        const answers = new Map<string, Availability>(
          data.availability
            .filter((row) => row.event_id === event.id)
            .map((row) => [row.player_id, row.status as Availability]),
        );
        const summary = availabilitySummary(squad, answers);
        const mine = data.myPlayerIds.filter((id) => squad.includes(id) || !event.team_id);
        const team = club.teams.find((item) => item.id === event.team_id);
        const closed = !event.availability_open || (!manager && repliesClosed(event.reply_by));
        return (
          <OfficeCard
            key={event.id}
            title={event.title}
            description={[when(event.starts_at), event.location, team?.name]
              .filter(Boolean)
              .join(" · ")}
            action={<Pill>{kinds.find(([value]) => value === event.kind)?.[1] ?? event.kind}</Pill>}
          >
            {event.notes && <p className="office-meta mb-3">{event.notes}</p>}
            {manager && event.team_id && squad.length === 0 && (
              <p role="status" className="mb-3 text-sm text-amber-200">
                No eligible players in this team. Check its roster before collecting availability.
              </p>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {event.reply_by && (
                <Pill tone={repliesClosed(event.reply_by) ? "bad" : "warn"}>
                  Reply by {when(event.reply_by)}
                </Pill>
              )}
              {event.squad_cap && (
                <Pill>
                  {summary.available}/{event.squad_cap} places
                  {summary.waitlist ? ` · ${summary.waitlist} waiting` : ""}
                </Pill>
              )}
              <button
                type="button"
                className="app-chip-button"
                onClick={() => addToCalendar(event)}
              >
                <CalendarCheck className="size-3.5" /> Add to calendar
              </button>
            </div>
            {mine.length > 0 && (
              <div className="mb-3 space-y-2">
                {mine.map((playerId) => (
                  <div key={playerId} className="office-row">
                    <span className="font-bold">{nameOfPlayer(club, playerId)}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {answers.get(playerId) === "waitlist" && (
                        <Pill tone="warn">On the waiting list</Pill>
                      )}
                      {choices.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="office-choice"
                          aria-pressed={answers.get(playerId) === status}
                          disabled={closed}
                          onClick={() =>
                            void act(
                              () =>
                                office.answer({
                                  organisationId,
                                  eventId: event.id,
                                  playerId,
                                  status,
                                }),
                              "Answer saved",
                            )
                          }
                        >
                          {answerLabels[status]}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
                {closed && <p className="office-meta">Answers are closed for this event.</p>}
              </div>
            )}
            {manager && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Pill tone="good">{summary.available} available</Pill>
                  <Pill tone="warn">{summary.maybe} maybe</Pill>
                  <Pill tone="bad">{summary.unavailable} can't</Pill>
                  {summary.waitlist > 0 && <Pill tone="warn">{summary.waitlist} waiting</Pill>}
                  <Pill>{summary.noReply.length} no reply</Pill>
                  {event.availability_open && summary.noReply.length > 0 && (
                    <button
                      type="button"
                      className="app-chip-button"
                      onClick={() =>
                        void remindNow(organisationId, "availability", event.id).catch(
                          (error: unknown) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Reminders could not be sent.",
                            ),
                        )
                      }
                    >
                      <BellRing className="size-3.5" /> Remind no-replies
                    </button>
                  )}
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => setOpen(open === event.id ? null : event.id)}
                  >
                    {open === event.id ? "Hide answers" : "See answers"}
                  </button>
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() =>
                      void act(() =>
                        office.updateEvent(event.id, {
                          availability_open: !event.availability_open,
                        }),
                      )
                    }
                  >
                    {event.availability_open ? "Close answers" : "Reopen answers"}
                  </button>
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => {
                      if (window.confirm(`Cancel "${event.title}"?`))
                        void act(
                          () =>
                            office.updateEvent(event.id, {
                              cancelled_at: new Date().toISOString(),
                            }),
                          "Event cancelled",
                        );
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
                            <Pill
                              tone={
                                answer === "available"
                                  ? "good"
                                  : answer === "maybe" || answer === "waitlist"
                                    ? "warn"
                                    : "bad"
                              }
                            >
                              {answerLabels[answer]}
                            </Pill>
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
  const [replyBy, setReplyBy] = useState("");
  const [cap, setCap] = useState("");
  const ownTeams = club.teams.filter((team) => !team.external);
  const validTeam = !teamId || ownTeams.some((team) => team.id === teamId);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const start = fromLocal(startsAt);
    if (!start || !validTeam || !title.trim()) return;
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
          reply_by: fromLocal(replyBy),
          squad_cap: cap ? Math.min(200, Math.max(1, Number(cap))) : null,
        }),
      "Event added — players and parents can now answer",
    );
    if (ok) {
      setTitle("");
      setNotes("");
    }
  };
  return (
    <OfficeCard
      title="Add an event"
      description="Matches, nets, tournaments, socials and meetings. Players and parents answer from their own login."
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <OfficeField label="Type">
          <select
            className="scorer-input"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {kinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Title" className="lg:col-span-2">
          <input
            required
            maxLength={140}
            className="scorer-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="U13 v Riverside"
          />
        </OfficeField>
        <OfficeField label="Team">
          <select
            className="scorer-input"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">Whole club</option>
            {ownTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Starts">
          <input
            required
            type="datetime-local"
            className="scorer-input"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </OfficeField>
        <OfficeField label="Ends (optional)">
          <input
            type="datetime-local"
            className="scorer-input"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </OfficeField>
        <OfficeField label="Where">
          <input
            maxLength={200}
            className="scorer-input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </OfficeField>
        <OfficeField label="Reply by (optional)">
          <input
            type="datetime-local"
            className="scorer-input"
            value={replyBy}
            onChange={(event) => setReplyBy(event.target.value)}
          />
        </OfficeField>
        <OfficeField label="Places (optional)">
          <input
            inputMode="numeric"
            className="scorer-input"
            value={cap}
            onChange={(event) => setCap(event.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 14 — then a waiting list"
          />
        </OfficeField>
        <OfficeField label="Notes" className="sm:col-span-2">
          <input
            maxLength={1000}
            className="scorer-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Whites, arrive 45 minutes early"
          />
        </OfficeField>
        {!validTeam && (
          <p role="alert" className="text-sm text-amber-200 sm:col-span-2">
            Choose an available club team or explicitly select Whole club.
          </p>
        )}
        <div className="flex items-end">
          <button disabled={!validTeam || !title.trim()} className="action-primary w-full">
            <CalendarPlus className="size-4" /> Add event
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}
