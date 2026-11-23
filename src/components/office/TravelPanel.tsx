import { useState } from "react";
import { Car, ShieldCheck } from "lucide-react";
import { can } from "@/lib/platform";
import { rideBlocker, seatsLeft, type BookingStatus } from "@/lib/club-office";
import { office, type ClubEvent } from "@/lib/club-office-cloud";
import { Empty, OfficeCard, OfficeField, Pill, day, fromLocal, nameOfMember, nameOfPlayer, upcoming, when, type OfficeProps } from "./ui";

const directions = [
  ["both", "There and back"],
  ["to", "There only"],
  ["from", "Back only"],
] as const;

export function TravelPanel(props: OfficeProps) {
  const { data, role } = props;
  const events = upcoming(data.events);
  return (
    <div className="space-y-4">
      <OfficeCard
        title="Safe lifts for juniors"
        description="Junior players can only ride with drivers the safeguarding officer has approved, and only after a parent says yes. Home addresses are never shown — use a meeting point."
      >
        <span className="flex flex-wrap gap-1.5">
          <Pill tone="good">
            <ShieldCheck className="size-3" /> {data.approvedDriverIds.length} approved driver{data.approvedDriverIds.length === 1 ? "" : "s"}
          </Pill>
          {data.approvedDriverIds.includes(data.userId) && <Pill tone="good">You're an approved driver</Pill>}
        </span>
      </OfficeCard>
      {events.length === 0 && <Empty>Travel plans appear here for upcoming events.</Empty>}
      {events.map((event) => (
        <EventTravel key={event.id} event={event} {...props} />
      ))}
      {can(role, "drivers.approve") && <Drivers {...props} />}
    </div>
  );
}

function EventTravel({ event, data, club, role, organisationId, act }: OfficeProps & { event: ClubEvent }) {
  const manager = can(role, "travel.manage");
  const [editing, setEditing] = useState(false);
  const [meetPoint, setMeetPoint] = useState(event.travel_meet_point ?? "");
  const [meetAt, setMeetAt] = useState("");
  const [travelNotes, setTravelNotes] = useState(event.travel_notes ?? "");
  const [offering, setOffering] = useState(false);
  const [seats, setSeats] = useState(3);
  const [direction, setDirection] = useState<string>("both");
  const [ridePoint, setRidePoint] = useState("");
  const [departs, setDeparts] = useState("");
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const rides = data.rides.filter((ride) => ride.event_id === event.id && !ride.cancelled_at);
  return (
    <OfficeCard
      title={event.title}
      description={when(event.starts_at)}
      action={
        <button type="button" className="app-chip-button" onClick={() => setOffering(!offering)}>
          <Car className="size-3.5" /> Offer a lift
        </button>
      }
    >
      <div className="office-row mb-3">
        <span>
          <span className="office-label">Club travel</span>
          {event.travel_meet_point || event.travel_meet_at ? (
            <span className="block text-sm">
              Meet {event.travel_meet_point ?? ""} {event.travel_meet_at ? `at ${when(event.travel_meet_at)}` : ""}
            </span>
          ) : (
            <span className="office-meta block">No meeting point set yet.</span>
          )}
          {event.travel_notes && <span className="office-meta block">{event.travel_notes}</span>}
        </span>
        {manager && (
          <button type="button" className="app-chip-button" onClick={() => setEditing(!editing)}>
            {editing ? "Close" : "Set meeting point"}
          </button>
        )}
      </div>
      {editing && (
        <form
          className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
          onSubmit={(item) => {
            item.preventDefault();
            void act(
              () =>
                office.updateEvent(event.id, {
                  travel_meet_point: meetPoint.trim() || null,
                  travel_meet_at: fromLocal(meetAt) ?? event.travel_meet_at,
                  travel_notes: travelNotes.trim() || null,
                }),
              "Travel plan saved",
            ).then((ok) => ok && setEditing(false));
          }}
        >
          <input aria-label="Meeting point" maxLength={200} className="scorer-input" placeholder="Club car park" value={meetPoint} onChange={(item) => setMeetPoint(item.target.value)} />
          <input aria-label="Meeting time" type="datetime-local" className="scorer-input" value={meetAt} onChange={(item) => setMeetAt(item.target.value)} />
          <input aria-label="Travel notes" maxLength={600} className="scorer-input" placeholder="Minibus leaves 8:15, back by 7pm" value={travelNotes} onChange={(item) => setTravelNotes(item.target.value)} />
          <button className="action-primary">Save</button>
        </form>
      )}
      {offering && (
        <form
          className="mb-3 grid gap-2 sm:grid-cols-[6rem_1fr_1.4fr_1fr_auto]"
          onSubmit={(item) => {
            item.preventDefault();
            void act(
              () =>
                office.offerRide({
                  organisation_id: organisationId,
                  event_id: event.id,
                  driver_user_id: data.userId,
                  seats,
                  direction,
                  meet_point: ridePoint.trim(),
                  departs_at: fromLocal(departs),
                }),
              "Lift offered",
            ).then((ok) => ok && setOffering(false));
          }}
        >
          <OfficeField label="Seats">
            <input type="number" min={1} max={8} className="scorer-input" value={seats} onChange={(item) => setSeats(Math.min(8, Math.max(1, Number(item.target.value) || 1)))} />
          </OfficeField>
          <OfficeField label="Trip">
            <select className="scorer-input" value={direction} onChange={(item) => setDirection(item.target.value)}>
              {directions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </OfficeField>
          <OfficeField label="Pick-up point (not a home address)">
            <input required maxLength={160} className="scorer-input" value={ridePoint} onChange={(item) => setRidePoint(item.target.value)} placeholder="Station car park" />
          </OfficeField>
          <OfficeField label="Leaving">
            <input type="datetime-local" className="scorer-input" value={departs} onChange={(item) => setDeparts(item.target.value)} />
          </OfficeField>
          <div className="flex items-end">
            <button className="action-primary w-full">Offer</button>
          </div>
        </form>
      )}
      {rides.length === 0 ? (
        <p className="office-meta">No lifts offered yet.</p>
      ) : (
        <div className="space-y-2">
          {rides.map((ride) => {
            const bookings = data.rideBookings.filter((booking) => booking.ride_id === ride.id);
            const left = seatsLeft(ride.seats, bookings.map((booking) => ({ status: booking.status as BookingStatus })));
            const approved = data.approvedDriverIds.includes(ride.driver_user_id);
            const mine = ride.driver_user_id === data.userId;
            return (
              <div key={ride.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{mine ? "Your lift" : nameOfMember(club, ride.driver_user_id)}</span>{" "}
                  {approved ? <Pill tone="good">Approved driver</Pill> : <Pill>Adults only</Pill>}
                  <span className="office-meta block">
                    {directions.find(([value]) => value === ride.direction)?.[1]} · from {ride.meet_point}
                    {ride.departs_at ? ` · ${when(ride.departs_at)}` : ""} · {left} of {ride.seats} seats free
                  </span>
                </span>
                {(mine || manager) && (
                  <button type="button" className="app-chip-button" onClick={() => void act(() => office.cancelRide(ride.id), "Lift cancelled")}>
                    Cancel lift
                  </button>
                )}
                <div className="w-full space-y-1.5">
                  {bookings
                    .filter((booking) => booking.status !== "cancelled")
                    .map((booking) => (
                      <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>
                          {nameOfPlayer(club, booking.player_id)}{" "}
                          <Pill tone={booking.status === "confirmed" ? "good" : booking.status === "declined" ? "bad" : "warn"}>{booking.status}</Pill>
                        </span>
                        <span className="flex gap-1">
                          {(mine || manager) && booking.status === "requested" && (
                            <>
                              <button type="button" className="app-chip-button" onClick={() => void act(() => office.setSeat(booking.id, "confirmed"), "Seat confirmed")}>
                                Confirm
                              </button>
                              <button type="button" className="app-chip-button" onClick={() => void act(() => office.setSeat(booking.id, "declined"))}>
                                Decline
                              </button>
                            </>
                          )}
                          {data.myPlayerIds.includes(booking.player_id) && (
                            <button type="button" className="app-chip-button" onClick={() => void act(() => office.setSeat(booking.id, "cancelled"), "Seat cancelled")}>
                              Cancel seat
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  {!mine &&
                    data.myPlayerIds
                      .filter((playerId) => !bookings.some((booking) => booking.player_id === playerId && booking.status !== "cancelled"))
                      .map((playerId) => {
                        const player = club.players.find((item) => item.id === playerId);
                        const junior = player?.isJunior ?? true;
                        const key = `${ride.id}:${playerId}`;
                        const blocker = rideBlocker({
                          isJunior: junior,
                          driverApproved: approved,
                          guardianConsent: consent[key] ?? false,
                          seatsLeft: left,
                          rideCancelled: Boolean(ride.cancelled_at),
                        });
                        return (
                          <div key={playerId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span>{player?.name ?? "Player"}</span>
                            <span className="flex flex-wrap items-center gap-2">
                              {junior && approved && (
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" checked={consent[key] ?? false} onChange={(item) => setConsent({ ...consent, [key]: item.target.checked })} />
                                  I'm their parent/guardian and agree
                                </label>
                              )}
                              {blocker && !(junior && approved && !consent[key]) ? (
                                <span className="office-meta">{blocker}</span>
                              ) : (
                                <button
                                  type="button"
                                  className="app-chip-button"
                                  disabled={Boolean(blocker)}
                                  onClick={() =>
                                    void act(
                                      () => office.requestSeat({ organisationId, rideId: ride.id, playerId, guardianConsent: consent[key] ?? false }),
                                      "Seat requested — the driver will confirm",
                                    )
                                  }
                                >
                                  Ask for a seat
                                </button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OfficeCard>
  );
}

function Drivers({ data, club, organisationId, act }: OfficeProps) {
  const [userId, setUserId] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const active = data.drivers.filter((driver) => !driver.revoked_at);
  return (
    <OfficeCard title="Approved drivers" description="Only owners and safeguarding officers can approve. Record what checks you've seen (e.g. DBS / police check, licence, insurance).">
      <form
        className="mb-3 grid gap-2 sm:grid-cols-[1.3fr_1fr_1.5fr_auto]"
        onSubmit={(item) => {
          item.preventDefault();
          if (!userId) return;
          void act(() => office.approveDriver({ organisationId, userId, expiresOn: expires || null, checksNote: note.trim() }), "Driver approved").then(
            (ok) => ok && (setUserId(""), setNote("")),
          );
        }}
      >
        <select aria-label="Member" required className="scorer-input" value={userId} onChange={(item) => setUserId(item.target.value)}>
          <option value="">Choose a member</option>
          {club.members
            .filter((member) => member.status === "active")
            .map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
        </select>
        <input aria-label="Approval ends" type="date" className="scorer-input" value={expires} onChange={(item) => setExpires(item.target.value)} />
        <input aria-label="Checks seen" maxLength={300} className="scorer-input" placeholder="Police check seen 2026-03" value={note} onChange={(item) => setNote(item.target.value)} />
        <button className="action-primary">Approve</button>
      </form>
      {active.length === 0 ? (
        <Empty>No approved drivers yet.</Empty>
      ) : (
        <div className="space-y-2">
          {active.map((driver) => (
            <div key={driver.id} className="office-row">
              <span>
                <span className="font-bold">{nameOfMember(club, driver.user_id)}</span>
                <span className="office-meta block">
                  {driver.checks_note ?? "No note"}
                  {driver.expires_on ? ` · until ${day(driver.expires_on)}` : ""}
                </span>
              </span>
              <button type="button" className="app-chip-button" onClick={() => void act(() => office.revokeDriver(driver.id), "Approval removed")}>
                Remove approval
              </button>
            </div>
          ))}
        </div>
      )}
    </OfficeCard>
  );
}
