import { useState } from "react";
import { can } from "@/lib/platform";
import { selectionWarnings, type Availability, type SelectionLike } from "@/lib/club-office";
import { office } from "@/lib/club-office-cloud";
import { Empty, OfficeCard, OfficeField, Pill, nameOfPlayer, upcoming, when, type OfficeProps } from "./ui";
import { squadFor } from "./EventsPanel";

const slots = [
  ["playing", "Playing"],
  ["twelfth", "12th"],
  ["reserve", "Reserve"],
] as const;

export function SelectionPanel(props: OfficeProps) {
  const { data, club, role, organisationId, act } = props;
  const manager = can(role, "events.manage");
  const events = upcoming(data.events).filter((event) => event.kind === "match" || event.kind === "tournament");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [sideSize, setSideSize] = useState(11);
  const event = events.find((item) => item.id === eventId) ?? events[0];

  if (!manager) {
    const published = events.filter((item) => item.selection_published_at);
    return published.length === 0 ? (
      <Empty>Team sheets appear here once the coach or team manager publishes them.</Empty>
    ) : (
      <div className="space-y-4">
        {published.map((item) => {
          const picks = data.selections.filter((row) => row.event_id === item.id);
          return (
            <OfficeCard key={item.id} title={item.title} description={when(item.starts_at)}>
              <TeamSheet picks={picks} club={club} myPlayerIds={data.myPlayerIds} />
            </OfficeCard>
          );
        })}
      </div>
    );
  }
  if (!event) return <Empty>Add a match or tournament in Events first, then pick the side here.</Empty>;

  const picks = data.selections.filter((row) => row.event_id === event.id);
  const answers = new Map<string, Availability>(
    data.availability.filter((row) => row.event_id === event.id).map((row) => [row.player_id, row.status as Availability]),
  );
  const warnings = selectionWarnings(
    picks.map((pick): SelectionLike => ({ playerId: pick.player_id, slot: pick.slot as SelectionLike["slot"], captain: pick.captain, wicketkeeper: pick.wicketkeeper })),
    answers,
    sideSize,
  );
  const squad = [...squadFor(event, club)].sort((a, b) => {
    const rank = (id: string) => ({ available: 0, maybe: 1, unavailable: 3 })[answers.get(id) ?? "maybe"] ?? 2;
    return rank(a) - rank(b);
  });
  return (
    <div className="space-y-4">
      <OfficeCard
        title="Pick the side"
        description="Only staff see this until you publish it. Players who said they can't make it are listed last."
        action={
          <button
            type="button"
            className={event.selection_published_at ? "action-secondary" : "action-primary"}
            onClick={() =>
              void act(
                () => office.updateEvent(event.id, { selection_published_at: event.selection_published_at ? null : new Date().toISOString() }),
                event.selection_published_at ? "Team sheet hidden" : "Team sheet published to members",
              )
            }
          >
            {event.selection_published_at ? "Unpublish" : "Publish team sheet"}
          </button>
        }
      >
        <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
          <OfficeField label="Event">
            <select className="scorer-input" value={event.id} onChange={(item) => setEventId(item.target.value)}>
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {when(item.starts_at)}
                </option>
              ))}
            </select>
          </OfficeField>
          <OfficeField label="Side size">
            <input type="number" min={4} max={15} className="scorer-input" value={sideSize} onChange={(item) => setSideSize(Number(item.target.value) || 11)} />
          </OfficeField>
        </div>
        {warnings.length > 0 && (
          <ul className="mb-3 space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>
                <Pill tone="warn">{warning}</Pill>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-1.5 md:grid-cols-2">
          {squad.map((playerId) => {
            const pick = picks.find((row) => row.player_id === playerId);
            const answer = answers.get(playerId);
            return (
              <div key={playerId} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{nameOfPlayer(club, playerId)}</span>{" "}
                  {answer && <Pill tone={answer === "available" ? "good" : answer === "maybe" ? "warn" : "bad"}>{answer === "unavailable" ? "can't" : answer}</Pill>}
                </span>
                <span className="flex flex-wrap gap-1">
                  {slots.map(([slot, label]) => (
                    <button
                      key={slot}
                      type="button"
                      className="office-choice"
                      aria-pressed={pick?.slot === slot}
                      onClick={() =>
                        void act(() =>
                          pick?.slot === slot
                            ? office.unpick(event.id, playerId)
                            : office.pick({ organisation_id: organisationId, event_id: event.id, player_id: playerId, slot }),
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                  {pick && (
                    <>
                      <button type="button" className="office-choice" aria-pressed={pick.captain} onClick={() => void act(() => office.setRole(event.id, playerId, "captain"))}>
                        C
                      </button>
                      <button type="button" className="office-choice" aria-pressed={pick.wicketkeeper} onClick={() => void act(() => office.setRole(event.id, playerId, "wicketkeeper"))}>
                        WK
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </OfficeCard>
    </div>
  );
}

function TeamSheet({ picks, club, myPlayerIds }: { picks: OfficeProps["data"]["selections"]; club: OfficeProps["club"]; myPlayerIds: string[] }) {
  return (
    <div className="space-y-3">
      {slots.map(([slot, label]) => {
        const rows = picks.filter((pick) => pick.slot === slot);
        if (!rows.length) return null;
        return (
          <div key={slot}>
            <span className="office-label">{label}</span>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((pick) => (
                <Pill key={pick.id} tone={myPlayerIds.includes(pick.player_id) ? "good" : undefined}>
                  {nameOfPlayer(club, pick.player_id)}
                  {pick.captain ? " (c)" : ""}
                  {pick.wicketkeeper ? " †" : ""}
                </Pill>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
