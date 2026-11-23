import { useEffect, useState, type FormEvent } from "react";
import { Banknote } from "lucide-react";
import { can } from "@/lib/platform";
import { currencyDigits, feeTotals, formatMoney, isOverdue, maxPayment, toMinor, type ChargeLike } from "@/lib/club-office";
import { office, type FeeCharge, type FeeSchedule } from "@/lib/club-office-cloud";
import { findRegion, regionFromLocale } from "@/lib/pricing";
import { Empty, OfficeCard, OfficeField, Pill, currencies, day, nameOfPlayer, type OfficeProps } from "./ui";
import { ClaimsQueue, HowToPay, MyClaims, PaymentAccounts, PayForm } from "./FeePayments";

const methods = [
  ["cash", "Cash"],
  ["bank_transfer", "Bank transfer"],
  ["raast", "Raast"],
  ["jazzcash", "JazzCash"],
  ["easypaisa", "Easypaisa"],
  ["mpesa", "M-Pesa"],
  ["upi", "UPI"],
  ["bkash", "bKash"],
  ["card", "Card (in person)"],
  ["other", "Other"],
] as const;

const frequencies = [
  ["season", "Per season"],
  ["annual", "Per year"],
  ["quarterly", "Per quarter"],
  ["monthly", "Per month"],
  ["match", "Match fee"],
  ["one_off", "One-off"],
] as const;

function asCharge(charge: FeeCharge): ChargeLike {
  return {
    amountMinor: Number(charge.amount_minor),
    paidMinor: Number(charge.paid_minor),
    currency: charge.currency,
    status: charge.status as ChargeLike["status"],
    dueOn: charge.due_on,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

function statusPill(charge: FeeCharge) {
  if (charge.status === "paid") return <Pill tone="good">Paid</Pill>;
  if (charge.status === "waived") return <Pill>Waived</Pill>;
  if (isOverdue(asCharge(charge), today())) return <Pill tone="bad">Overdue</Pill>;
  return <Pill tone="warn">{charge.status === "part_paid" ? "Part paid" : "Due"}</Pill>;
}

export function FeesPanel(props: OfficeProps) {
  const { data, club, role } = props;
  const manager = can(role, "fees.manage");
  if (!manager) return <MemberFees {...props} />;
  return (
    <div className="space-y-4">
      <Totals charges={data.charges} />
      <ClaimsQueue {...props} />
      <NewSchedule {...props} />
      <Schedules {...props} />
      <Charges {...props} />
      <PaymentAccounts {...props} />
    </div>
  );
}

function MemberFees(props: OfficeProps) {
  const { data, club } = props;
  const [paying, setPaying] = useState<string | null>(null);
  {
    const mine = data.charges;
    return (
      <div className="space-y-4">
        {mine.some((charge) => maxPayment(asCharge(charge)) > 0) && <HowToPay {...props} />}
        <OfficeCard title="My fees" description="Only you, your family and the club's treasurer can see these.">
          {mine.length === 0 ? (
            <Empty>Nothing to pay right now.</Empty>
          ) : (
            <div className="space-y-2">
              {mine.map((charge) => (
                <div key={charge.id} className="office-row">
                  <span>
                    <span className="font-bold">{charge.description}</span>
                    <span className="office-meta block">
                      {nameOfPlayer(club, charge.player_id)}
                      {charge.due_on ? ` · due ${day(charge.due_on)}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {formatMoney(maxPayment(asCharge(charge)), charge.currency)} left {statusPill(charge)}
                    {maxPayment(asCharge(charge)) > 0 && (
                      <button type="button" className="action-primary" onClick={() => setPaying(paying === charge.id ? null : charge.id)}>
                        I've paid
                      </button>
                    )}
                  </span>
                  {paying === charge.id && <PayForm {...props} charge={charge} onDone={() => setPaying(null)} />}
                </div>
              ))}
            </div>
          )}
        </OfficeCard>
        <MyClaims {...props} />
        <FeeList schedules={data.schedules} />
      </div>
    );
  }
}

function FeeList({ schedules }: { schedules: FeeSchedule[] }) {
  const active = schedules.filter((item) => item.active);
  if (!active.length) return null;
  return (
    <OfficeCard title="Club fees" description="What the club charges.">
      <div className="space-y-2">
        {active.map((item) => (
          <div key={item.id} className="office-row">
            <span className="font-bold">{item.name}</span>
            <span>
              {formatMoney(Number(item.amount_minor), item.currency)} · {frequencies.find(([value]) => value === item.frequency)?.[1]}
            </span>
          </div>
        ))}
      </div>
    </OfficeCard>
  );
}

function Totals({ charges }: { charges: FeeCharge[] }) {
  const totals = feeTotals(charges.map(asCharge), today());
  if (!totals.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {totals.flatMap((row) => [
        <div key={`${row.currency}-paid`} className="office-stat">
          <span className="office-label">Collected · {row.currency}</span>
          <strong>{formatMoney(row.paid, row.currency)}</strong>
        </div>,
        <div key={`${row.currency}-out`} className="office-stat">
          <span className="office-label">Still owed</span>
          <strong>{formatMoney(row.outstanding, row.currency)}</strong>
        </div>,
        <div key={`${row.currency}-late`} className="office-stat">
          <span className="office-label">Overdue</span>
          <strong>{formatMoney(row.overdue, row.currency)}</strong>
        </div>,
      ])}
    </div>
  );
}

function NewSchedule({ data, organisationId, club, act }: OfficeProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(data.schedules[0]?.currency ?? "GBP");
  const [frequency, setFrequency] = useState<string>("season");
  const [dueOn, setDueOn] = useState("");
  const [teamId, setTeamId] = useState("");
  useEffect(() => {
    if (data.schedules.length) return;
    const guess = findRegion(regionFromLocale(navigator.language))?.currency;
    if (guess) setCurrency(guess);
  }, [data.schedules.length]);
  const minor = toMinor(amount, currency);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!minor) return;
    const ok = await act(
      () =>
        office.addSchedule({
          organisation_id: organisationId,
          name: name.trim(),
          amount_minor: minor,
          currency,
          frequency,
          due_on: dueOn || null,
          team_id: teamId || null,
        }),
      "Fee added",
    );
    if (ok) {
      setName("");
      setAmount("");
    }
  };
  return (
    <OfficeCard title="Add a fee" description="Subs, match fees, tour costs or kit levies. Then charge a team or the whole club in one tap.">
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OfficeField label="Name" className="lg:col-span-2">
          <input required maxLength={120} className="scorer-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Senior season subs" />
        </OfficeField>
        <OfficeField label="Amount">
          <input required inputMode="decimal" className="scorer-input" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25,000" />
        </OfficeField>
        <OfficeField label="Currency">
          <select className="scorer-input" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="How often">
          <select className="scorer-input" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            {frequencies.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Due by">
          <input type="date" className="scorer-input" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
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
        <div className="flex items-end">
          <button disabled={!minor} className="action-primary w-full">
            <Banknote className="size-4" /> Add fee
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}

function Schedules({ data, club, act }: OfficeProps) {
  if (!data.schedules.length) return null;
  return (
    <OfficeCard title="Fees" description="Charging twice is safe — anyone already charged is skipped.">
      <div className="space-y-2">
        {data.schedules.map((schedule) => {
          const team = club.teams.find((item) => item.id === schedule.team_id);
          const playerIds = team ? team.playerIds : club.players.map((player) => player.id);
          const charged = data.charges.filter((charge) => charge.schedule_id === schedule.id).length;
          return (
            <div key={schedule.id} className="office-row">
              <span>
                <span className="font-bold">{schedule.name}</span>
                <span className="office-meta block">
                  {formatMoney(Number(schedule.amount_minor), schedule.currency)} · {team?.name ?? "Whole club"} · {charged} charged
                </span>
              </span>
              <button
                type="button"
                className="app-chip-button"
                disabled={!playerIds.length}
                onClick={() => void act(() => office.chargePlayers(schedule, playerIds), `Charged ${playerIds.length} players`)}
              >
                Charge {playerIds.length} players
              </button>
            </div>
          );
        })}
      </div>
    </OfficeCard>
  );
}

function Charges({ data, club, organisationId, act }: OfficeProps) {
  const [filter, setFilter] = useState<"owed" | "all">("owed");
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const rows = data.charges.filter((charge) => filter === "all" || charge.status === "due" || charge.status === "part_paid");
  return (
    <OfficeCard
      title="Who owes what"
      description="Every payment is logged with who recorded it."
      action={
        <span className="flex gap-1">
          <button type="button" className="office-choice" aria-pressed={filter === "owed"} onClick={() => setFilter("owed")}>
            Still owed
          </button>
          <button type="button" className="office-choice" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty>{filter === "owed" ? "Everyone is paid up." : "No charges yet."}</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((charge) => {
            const left = maxPayment(asCharge(charge));
            const minor = toMinor(amount, charge.currency);
            const payments = data.payments.filter((payment) => payment.charge_id === charge.id);
            return (
              <div key={charge.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{nameOfPlayer(club, charge.player_id)}</span>
                  <span className="office-meta block">
                    {charge.description} · {formatMoney(Number(charge.amount_minor), charge.currency)}
                    {payments.length ? ` · ${payments.length} payment${payments.length === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {left > 0 && <span className="text-xs font-bold">{formatMoney(left, charge.currency)} left</span>}
                  {statusPill(charge)}
                  {left > 0 && (
                    <button
                      type="button"
                      className="app-chip-button"
                      onClick={() => {
                        setPaying(paying === charge.id ? null : charge.id);
                        setAmount(String(left / 10 ** currencyDigits(charge.currency)));
                      }}
                    >
                      Record payment
                    </button>
                  )}
                </span>
                {paying === charge.id && (
                  <form
                    className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!minor || minor > left) return;
                      void act(
                        () =>
                          office.recordPayment({
                            organisation_id: organisationId,
                            charge_id: charge.id,
                            amount_minor: minor,
                            method,
                            reference: reference.trim() || null,
                          }),
                        "Payment recorded",
                      ).then((ok) => ok && setPaying(null));
                    }}
                  >
                    <input aria-label="Amount paid" inputMode="decimal" className="scorer-input" value={amount} onChange={(event) => setAmount(event.target.value)} />
                    <select aria-label="Paid by" className="scorer-input" value={method} onChange={(event) => setMethod(event.target.value)}>
                      {methods.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input aria-label="Reference" maxLength={120} className="scorer-input" placeholder="Receipt / ref (optional)" value={reference} onChange={(event) => setReference(event.target.value)} />
                    <button disabled={!minor || minor > left} className="action-primary">
                      Save
                    </button>
                    <button
                      type="button"
                      className="action-secondary"
                      onClick={() => {
                        const reason = window.prompt("Why is this being waived?") ?? "";
                        if (reason) void act(() => office.waive(charge.id, reason), "Charge waived");
                      }}
                    >
                      Waive
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </OfficeCard>
  );
}
