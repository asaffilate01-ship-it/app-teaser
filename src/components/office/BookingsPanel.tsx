import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { can } from "@/lib/platform";
import { clashes, validBookingWindow } from "@/lib/club-office";
import { office, type GroundBooking } from "@/lib/club-office-cloud";
import { Empty, OfficeCard, OfficeField, Pill, fromLocal, when, type OfficeProps } from "./ui";

const purposes = [
  ["match", "Match"],
  ["nets", "Nets"],
  ["training", "Training"],
  ["event", "Event"],
  ["other", "Other"],
] as const;

function statusPill(booking: GroundBooking) {
  if (booking.status === "approved") return <Pill tone="good">Approved</Pill>;
  if (booking.status === "requested") return <Pill tone="warn">Waiting</Pill>;
  if (booking.status === "declined") return <Pill tone="bad">Declined</Pill>;
  return <Pill>Cancelled</Pill>;
}

export function BookingsPanel(props: OfficeProps) {
  const { data, role, organisationId, act } = props;
  const manager = can(role, "bookings.manage");
  const requester = can(role, "bookings.request");
  const ours = data.bookings.filter((booking) => booking.organisation_id === organisationId);
  const sent = data.bookings.filter(
    (booking) =>
      booking.requester_organisation_id === organisationId &&
      booking.organisation_id !== organisationId,
  );
  const groundName = (id: string) =>
    data.grounds.find((ground) => ground.id === id)?.name ??
    data.bookableGrounds.find((g) => g.ground_id === id)?.ground_name ??
    "Ground";
  const visible = ours.filter(
    (booking) => new Date(booking.ends_at).getTime() > Date.now() && booking.status !== "cancelled",
  );
  return (
    <div className="space-y-4">
      {requester && data.grounds.length > 0 && <BookOwn {...props} />}
      <OfficeCard title="Our ground calendar" description="Approved bookings can never overlap.">
        {visible.length === 0 ? (
          <Empty>
            {data.grounds.length ? "No upcoming bookings." : "Add a ground in Competitions first."}
          </Empty>
        ) : (
          <div className="space-y-2">
            {visible.map((booking) => (
              <div key={booking.id} className="office-row">
                <span>
                  <span className="font-bold">{booking.title}</span>
                  <span className="office-meta block">
                    {groundName(booking.ground_id)} · {when(booking.starts_at)} –{" "}
                    {new Date(booking.ends_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {booking.requester_organisation_id &&
                    booking.requester_organisation_id !== organisationId
                      ? " · request from another club"
                      : ""}
                  </span>
                  {booking.note && <span className="office-meta block">“{booking.note}”</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {statusPill(booking)}
                  {manager && booking.status === "requested" && (
                    <>
                      <button
                        type="button"
                        className="app-chip-button"
                        onClick={() =>
                          void act(
                            () => office.decideBooking(booking.id, "approved"),
                            "Booking approved",
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="app-chip-button"
                        onClick={() =>
                          void act(
                            () => office.decideBooking(booking.id, "declined"),
                            "Booking declined",
                          )
                        }
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {(manager || booking.requested_by === data.userId) && (
                    <button
                      type="button"
                      className="app-chip-button"
                      onClick={() =>
                        void act(() => office.cancelBooking(booking.id), "Booking cancelled")
                      }
                    >
                      Cancel
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </OfficeCard>
      {manager && data.grounds.length > 0 && (
        <OfficeCard
          title="Open our grounds to other clubs"
          description="Other clubs see the ground name, your note and busy times — never who booked."
        >
          <div className="space-y-2">
            {data.grounds.map((ground) => (
              <div key={ground.id} className="office-row">
                <span className="font-bold">{ground.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {ground.bookable && <Pill tone="good">Open to requests</Pill>}
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => {
                      const note = ground.bookable
                        ? ground.booking_note
                        : (window.prompt(
                            "Note for other clubs (price, nets, contact)",
                            ground.booking_note ?? "",
                          ) ?? null);
                      void act(() =>
                        office.setGroundBookable(
                          ground.id,
                          !ground.bookable,
                          note?.slice(0, 300) || null,
                        ),
                      );
                    }}
                  >
                    {ground.bookable ? "Close to requests" : "Open to requests"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </OfficeCard>
      )}
      {requester && <RequestOther {...props} />}
      {sent.length > 0 && (
        <OfficeCard title="Our requests to other clubs">
          <div className="space-y-2">
            {sent.map((booking) => (
              <div key={booking.id} className="office-row">
                <span>
                  <span className="font-bold">{booking.title}</span>
                  <span className="office-meta block">
                    {groundName(booking.ground_id)} · {when(booking.starts_at)}
                    {booking.decision_note ? ` · ${booking.decision_note}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  {statusPill(booking)}
                  {booking.status !== "cancelled" && booking.status !== "declined" && (
                    <button
                      type="button"
                      className="app-chip-button"
                      onClick={() =>
                        void act(() => office.cancelBooking(booking.id), "Request cancelled")
                      }
                    >
                      Cancel
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </OfficeCard>
      )}
    </div>
  );
}

function BookingFields({
  purpose,
  setPurpose,
  title,
  setTitle,
  startsAt,
  setStartsAt,
  endsAt,
  setEndsAt,
}: {
  purpose: string;
  setPurpose: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  startsAt: string;
  setStartsAt: (value: string) => void;
  endsAt: string;
  setEndsAt: (value: string) => void;
}) {
  return (
    <>
      <OfficeField label="What for">
        <select
          className="scorer-input"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        >
          {purposes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </OfficeField>
      <OfficeField label="Title">
        <input
          required
          maxLength={120}
          className="scorer-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="2nd XI nets"
        />
      </OfficeField>
      <OfficeField label="From">
        <input
          required
          type="datetime-local"
          className="scorer-input"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
      </OfficeField>
      <OfficeField label="Until">
        <input
          required
          type="datetime-local"
          className="scorer-input"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />
      </OfficeField>
    </>
  );
}

function BookOwn({ data, role, organisationId, act }: OfficeProps) {
  const [groundId, setGroundId] = useState(data.grounds[0]?.id ?? "");
  const [purpose, setPurpose] = useState("nets");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const start = fromLocal(startsAt);
  const end = fromLocal(endsAt);
  const validWindow = validBookingWindow(start, end);
  const validGround = data.grounds.some((ground) => ground.id === groundId);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const taken = data.bookings
    .filter((booking) => booking.ground_id === groundId && booking.status === "approved")
    .map((booking) => ({
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      title: booking.title,
    }));
  const clash = start && end ? clashes({ startsAt: start, endsAt: end }, taken) : [];
  const direct = can(role, "bookings.manage");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !start ||
      !end ||
      !validWindow ||
      !validGround ||
      !title.trim() ||
      clash.length ||
      submissionLock.current
    )
      return;
    submissionLock.current = true;
    setSubmitting(true);
    try {
      const ok = await act(
        () =>
          office.bookOwnGround({
            organisation_id: organisationId,
            ground_id: groundId,
            title: title.trim(),
            purpose,
            starts_at: start,
            ends_at: end,
            status: direct ? "approved" : "requested",
          }),
        direct ? "Booked" : "Request sent to the club admin",
      );
      if (ok) setTitle("");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };
  return (
    <OfficeCard
      title="Book our ground or nets"
      description={
        direct ? "Your booking is approved straight away." : "A club admin approves your request."
      }
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <OfficeField label="Ground">
          <select
            className="scorer-input"
            value={groundId}
            onChange={(event) => setGroundId(event.target.value)}
          >
            {data.grounds.map((ground) => (
              <option key={ground.id} value={ground.id}>
                {ground.name}
              </option>
            ))}
          </select>
        </OfficeField>
        <BookingFields
          {...{ purpose, setPurpose, title, setTitle, startsAt, setStartsAt, endsAt, setEndsAt }}
        />
        {startsAt && endsAt && !validWindow && (
          <p role="alert" className="text-sm text-amber-200 sm:col-span-2">
            The end time must be after the start time.
          </p>
        )}
        {clash.length > 0 && (
          <p className="sm:col-span-2 lg:col-span-4">
            <Pill tone="bad">Clashes with {clash.map((item) => item.title).join(", ")}</Pill>
          </p>
        )}
        <div className="flex items-end lg:col-start-5">
          <button
            disabled={!validWindow || !validGround || !title.trim() || clash.length > 0 || submitting}
            className="action-primary w-full"
          >
            <MapPin className="size-4" /> {submitting ? "Saving…" : direct ? "Book" : "Request"}
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}

function RequestOther({ data, organisationId, act }: OfficeProps) {
  const [groundId, setGroundId] = useState("");
  const [availability, setAvailability] = useState<{
    groundId: string;
    slots: { starts_at: string; ends_at: string }[] | null;
    error: boolean;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submissionLock = useRef(false);
  const [purpose, setPurpose] = useState("match");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const ground = data.bookableGrounds.find((item) => item.ground_id === groundId);
  const start = fromLocal(startsAt);
  const end = fromLocal(endsAt);
  const validWindow = validBookingWindow(start, end);
  const current = availability?.groundId === groundId ? availability : null;
  const busy = current?.slots ?? null;
  const clash =
    start && end && busy
      ? clashes(
          { startsAt: start, endsAt: end },
          busy.map((slot) => ({ startsAt: slot.starts_at, endsAt: slot.ends_at })),
        )
      : [];
  useEffect(() => {
    if (!groundId) return;
    let active = true;
    setAvailability(null);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 90 * 86_400_000).toISOString();
    void office
      .busySlots(groundId, from, to)
      .then((slots) => {
        if (active) setAvailability({ groundId, slots, error: false });
      })
      .catch(() => {
        if (active) setAvailability({ groundId, slots: null, error: true });
      });
    return () => {
      active = false;
    };
  }, [groundId, retry]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !ground ||
      !start ||
      !end ||
      !validWindow ||
      !title.trim() ||
      !busy ||
      clash.length ||
      submissionLock.current
    )
      return;
    submissionLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Check the requested interval itself, even outside the 90-day preview.
      const latest = await office.busySlots(ground.ground_id, start, end);
      if (
        clashes(
          { startsAt: start, endsAt: end },
          latest.map((slot) => ({ startsAt: slot.starts_at, endsAt: slot.ends_at })),
        ).length
      ) {
        setSubmitError("That interval now overlaps an approved booking. Choose another time.");
        return;
      }
      const ok = await act(
        () =>
          office.requestOtherGround({
            groundId: ground.ground_id,
            requesterOrg: organisationId,
            title: title.trim(),
            purpose,
            startsAt: start,
            endsAt: end,
            note: note.trim(),
          }),
        `Request sent to ${ground.organisation_name}`,
      );
      if (ok) setTitle("");
    } catch {
      setSubmitError("Availability could not be verified. No booking request was sent.");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };
  if (!data.bookableGrounds.length) return null;
  return (
    <OfficeCard
      title="Book another club's ground"
      description="Clubs that open their grounds appear here. They approve or decline your request."
    >
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => void submit(event)}
      >
        <OfficeField label="Ground" className="sm:col-span-2">
          <select
            required
            className="scorer-input"
            value={groundId}
            disabled={submitting}
            onChange={(event) => {
              setGroundId(event.target.value);
              setSubmitError("");
            }}
          >
            <option value="">Choose a ground</option>
            {data.bookableGrounds.map((item) => (
              <option key={item.ground_id} value={item.ground_id}>
                {item.ground_name} — {item.organisation_name}
              </option>
            ))}
          </select>
        </OfficeField>
        {ground?.booking_note && (
          <p className="office-meta sm:col-span-2 self-end">{ground.booking_note}</p>
        )}
        <BookingFields
          {...{ purpose, setPurpose, title, setTitle, startsAt, setStartsAt, endsAt, setEndsAt }}
        />
        <OfficeField label="Message" className="sm:col-span-2 lg:col-span-3">
          <input
            maxLength={500}
            className="scorer-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Two teams, 40 overs, we bring our own balls"
          />
        </OfficeField>
        {startsAt && endsAt && !validWindow && (
          <p role="alert" className="text-sm text-amber-200 sm:col-span-2">
            The end time must be after the start time.
          </p>
        )}
        {groundId && !current && (
          <p role="status" className="office-meta sm:col-span-2">
            Checking ground availability…
          </p>
        )}
        {current?.error && (
          <div role="alert" className="sm:col-span-2 text-sm text-amber-200">
            Ground availability is unavailable.
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {submitError && (
          <p role="alert" className="text-sm text-amber-200 sm:col-span-2">
            {submitError}
          </p>
        )}
        <div className="flex items-end">
          <button
            disabled={!ground || !validWindow || !title.trim() || !busy || clash.length > 0 || submitting}
            className="action-primary w-full"
          >
            {submitting ? "Checking and sending…" : "Send request"}
          </button>
        </div>
        {busy && busy.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-4">
            <span className="office-label">Already booked (next 90 days)</span>
            <div className="flex flex-wrap gap-1.5">
              {busy.slice(0, 24).map((slot) => (
                <Pill
                  key={slot.starts_at}
                  tone={clash.some((item) => item.startsAt === slot.starts_at) ? "bad" : undefined}
                >
                  {when(slot.starts_at)}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </form>
    </OfficeCard>
  );
}
