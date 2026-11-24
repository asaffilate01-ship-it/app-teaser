import { useState } from "react";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import {
  claimableAmount,
  cleanReference,
  currencyDigits,
  formatMoney,
  toMinor,
  transferMethods,
  type ChargeLike,
} from "@/lib/club-office";
import { office, type FeeCharge } from "@/lib/club-office-cloud";
import {
  Empty,
  OfficeCard,
  OfficeField,
  Pill,
  day,
  nameOfMember,
  nameOfPlayer,
  type OfficeProps,
} from "./ui";

const methodName = (method: string) =>
  transferMethods.find(([value]) => value === method)?.[1] ?? method;

export function asChargeLike(charge: FeeCharge): ChargeLike {
  return {
    amountMinor: Number(charge.amount_minor),
    paidMinor: Number(charge.paid_minor),
    currency: charge.currency,
    status: charge.status as ChargeLike["status"],
    dueOn: charge.due_on,
  };
}

/** Where to send money: shown to every member. */
export function HowToPay({ data }: OfficeProps) {
  const accounts = data.paymentAccounts.filter((account) => account.active);
  if (!accounts.length)
    return (
      <Empty>The treasurer hasn't added payment details yet. Pay them in person for now.</Empty>
    );
  return (
    <OfficeCard
      title="How to pay"
      description="Send the money, then tap “I've paid” and enter the transaction reference. The treasurer checks it and marks it paid."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {accounts.map((account) => (
          <div key={account.id} className="office-row">
            <span className="min-w-0">
              <Pill tone="good">{methodName(account.method)}</Pill>
              <span className="mt-1 block font-bold">{account.account_number}</span>
              <span className="office-meta block">{account.account_title}</span>
              {account.instructions && (
                <span className="office-meta block">{account.instructions}</span>
              )}
            </span>
            <button
              type="button"
              className="app-chip-button"
              aria-label={`Copy ${methodName(account.method)} number`}
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(account.account_number)
                  .then(() => toast.success("Copied"))
              }
            >
              <Copy className="size-3.5" /> Copy
            </button>
          </div>
        ))}
      </div>
    </OfficeCard>
  );
}

/** "I've paid" form for one charge. */
export function PayForm({
  charge,
  data,
  organisationId,
  act,
  onDone,
}: OfficeProps & { charge: FeeCharge; onDone: () => void }) {
  const methods = [
    ...new Set(
      data.paymentAccounts.filter((account) => account.active).map((account) => account.method),
    ),
  ];
  const pending = data.claims
    .filter((claim) => claim.charge_id === charge.id && claim.status === "pending")
    .map((claim) => Number(claim.amount_minor));
  const most = claimableAmount(asChargeLike(charge), pending);
  const [method, setMethod] = useState(methods[0] ?? "raast");
  const [amount, setAmount] = useState(String(most / 10 ** currencyDigits(charge.currency)));
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const minor = toMinor(amount, charge.currency);
  const ref = cleanReference(reference);
  if (most <= 0)
    return (
      <p className="office-meta w-full">
        A payment for the full amount is already waiting to be checked.
      </p>
    );
  return (
    <form
      className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!minor || minor > most || !ref) return;
        void act(
          () =>
            office.submitClaim({
              organisationId,
              chargeId: charge.id,
              userId: data.userId,
              amountMinor: minor,
              method,
              reference: ref,
              paidOn,
              note: "",
            }),
          "Sent — the treasurer will confirm it",
        ).then((ok) => ok && onDone());
      }}
    >
      <OfficeField label="Paid by">
        <select
          className="scorer-input"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        >
          {(methods.length ? methods : transferMethods.map(([value]) => value)).map((value) => (
            <option key={value} value={value}>
              {methodName(value)}
            </option>
          ))}
        </select>
      </OfficeField>
      <OfficeField label={`Amount (max ${formatMoney(most, charge.currency)})`}>
        <input
          required
          inputMode="decimal"
          className="scorer-input"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </OfficeField>
      <OfficeField label="Transaction reference">
        <input
          required
          minLength={3}
          maxLength={120}
          className="scorer-input"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="e.g. TID 0123456789"
        />
      </OfficeField>
      <OfficeField label="Date paid">
        <input
          type="date"
          className="scorer-input"
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
        />
      </OfficeField>
      <div className="flex items-end">
        <button disabled={!minor || minor > most || !ref} className="action-primary w-full">
          <Send className="size-4" /> Send
        </button>
      </div>
    </form>
  );
}

export function MyClaims({ data, club }: OfficeProps) {
  if (!data.claims.length) return null;
  return (
    <OfficeCard title="Payments I've sent">
      <div className="space-y-2">
        {data.claims.map((claim) => {
          const charge = data.charges.find((row) => row.id === claim.charge_id);
          return (
            <div key={claim.id} className="office-row">
              <span>
                <span className="font-bold">
                  {charge
                    ? `${charge.description} · ${nameOfPlayer(club, charge.player_id)}`
                    : "Fee"}
                </span>
                <span className="office-meta block">
                  {methodName(claim.method)} · ref {claim.reference} · {day(claim.paid_on)}
                  {claim.decision_note ? ` · ${claim.decision_note}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {charge && formatMoney(Number(claim.amount_minor), charge.currency)}
                <Pill
                  tone={
                    claim.status === "confirmed"
                      ? "good"
                      : claim.status === "rejected"
                        ? "bad"
                        : "warn"
                  }
                >
                  {claim.status === "pending"
                    ? "Being checked"
                    : claim.status === "confirmed"
                      ? "Confirmed"
                      : "Not found"}
                </Pill>
              </span>
            </div>
          );
        })}
      </div>
    </OfficeCard>
  );
}

/** Treasurer: payments members say they've sent, to check against the bank or wallet statement. */
export function ClaimsQueue({ data, club, act }: OfficeProps) {
  const pending = data.claims.filter((claim) => claim.status === "pending");
  return (
    <OfficeCard
      title={`Payments to check${pending.length ? ` (${pending.length})` : ""}`}
      description="Match each reference against your Raast, bank or wallet statement before confirming."
    >
      {pending.length === 0 ? (
        <Empty>Nothing waiting.</Empty>
      ) : (
        <div className="space-y-2">
          {pending.map((claim) => {
            const charge = data.charges.find((row) => row.id === claim.charge_id);
            return (
              <div key={claim.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">
                    {charge ? nameOfPlayer(club, charge.player_id) : "Player"} ·{" "}
                    {charge ? formatMoney(Number(claim.amount_minor), charge.currency) : ""}
                  </span>
                  <span className="office-meta block">
                    {methodName(claim.method)} · ref <strong>{claim.reference}</strong> · paid{" "}
                    {day(claim.paid_on)} · sent by {nameOfMember(club, claim.submitted_by)}
                  </span>
                  {charge && <span className="office-meta block">{charge.description}</span>}
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() =>
                      void act(() => office.decideClaim(claim.id, true, ""), "Payment confirmed")
                    }
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => {
                      const note = window.prompt(
                        "Why? (the member sees this)",
                        "Reference not found on statement",
                      );
                      if (note != null)
                        void act(
                          () => office.decideClaim(claim.id, false, note),
                          "Marked not found",
                        );
                    }}
                  >
                    Not found
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </OfficeCard>
  );
}

/** Treasurer: the club's Raast / wallet / bank details members pay into. */
export function PaymentAccounts({ data, organisationId, act }: OfficeProps) {
  const [method, setMethod] = useState("raast");
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [instructions, setInstructions] = useState("");
  return (
    <OfficeCard
      title="Club payment details"
      description="Members see these in the app. Use the club's own Raast ID, IBAN or wallet number — never a personal password or PIN."
    >
      <form
        className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[9rem_1.2fr_1.2fr_1.5fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void act(
            () =>
              office.addPaymentAccount({
                organisation_id: organisationId,
                method,
                account_title: title.trim(),
                account_number: number.trim(),
                instructions: instructions.trim() || null,
              }),
            "Payment details added",
          ).then((ok) => ok && (setNumber(""), setInstructions("")));
        }}
      >
        <OfficeField label="Method">
          <select
            className="scorer-input"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            {transferMethods.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Account title">
          <input
            required
            maxLength={120}
            className="scorer-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Riverside Cricket Club"
          />
        </OfficeField>
        <OfficeField label="Raast ID / IBAN / number">
          <input
            required
            minLength={3}
            maxLength={60}
            className="scorer-input"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="03001234567"
          />
        </OfficeField>
        <OfficeField label="Instructions (optional)">
          <input
            maxLength={300}
            className="scorer-input"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Put the player's name in the message"
          />
        </OfficeField>
        <div className="flex items-end">
          <button className="action-primary w-full">Add</button>
        </div>
      </form>
      {data.paymentAccounts.length === 0 ? (
        <Empty>No payment details yet.</Empty>
      ) : (
        <div className="space-y-2">
          {data.paymentAccounts.map((account) => (
            <div key={account.id} className="office-row">
              <span>
                <Pill tone={account.active ? "good" : undefined}>{methodName(account.method)}</Pill>{" "}
                <span className="font-bold">{account.account_number}</span>
                <span className="office-meta block">{account.account_title}</span>
              </span>
              <button
                type="button"
                className="app-chip-button"
                onClick={() =>
                  void act(() => office.setPaymentAccount(account.id, !account.active))
                }
              >
                {account.active ? "Hide" : "Show"}
              </button>
            </div>
          ))}
        </div>
      )}
    </OfficeCard>
  );
}
