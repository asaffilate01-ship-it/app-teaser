import { useEffect, useState } from "react";
import { BellRing, LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { can } from "@/lib/platform";
import { channelLabels, type ReminderChannel } from "@/lib/reminders";
import {
  defaultClubSettings,
  loadClubReminderSettings,
  saveClubReminderSettings,
} from "@/lib/reminders-cloud";
import { reminderSetup, sendRemindersNow } from "@/lib/reminders.functions";
import { OfficeCard, OfficeField, Pill, type OfficeProps } from "./ui";

type Kind = "availability" | "fees" | "umpires";

/** Says how many reminders went out, and on which channels. */
export function sentSummary(
  queued: number,
  sent: Partial<Record<ReminderChannel, number>>,
): string {
  if (!queued)
    return "Nobody to remind right now — anyone already reminded in the last hour is skipped.";
  const extra = (Object.entries(sent) as [ReminderChannel, number][])
    .filter(([, count]) => count > 0)
    .map(
      ([channel, count]) =>
        `${count} ${channelLabels[channel].toLowerCase()}${count === 1 ? "" : "s"}`,
    );
  return `${queued} reminder${queued === 1 ? "" : "s"} sent in the app${extra.length ? `, plus ${extra.join(", ")}` : ""}.`;
}

export async function remindNow(
  organisationId: string,
  kind: Kind,
  target?: string,
): Promise<void> {
  const result = await sendRemindersNow({
    data: { organisationId, kind, ...(target ? { target } : {}) },
  });
  if (!result.ok) throw new Error(result.error ?? "Reminders could not be sent.");
  toast.success(sentSummary(result.queued, result.sent));
  window.dispatchEvent(new Event("criclume:reminders"));
}

export function RemindersPanel({ organisationId, role }: OfficeProps) {
  const admin = role === "owner" || role === "club_admin" || role === "league_admin";
  const [settings, setSettings] = useState<typeof defaultClubSettings | null>(null);
  const [paidPlan, setPaidPlan] = useState(false);
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof reminderSetup>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void loadClubReminderSettings(organisationId).then(({ settings: loaded, paidPlan: paid }) => {
      setSettings(loaded);
      setPaidPlan(paid);
    });
    void reminderSetup()
      .then(setSetup)
      .catch(() => setSetup(null));
  }, [organisationId]);

  const send = async (kind: Kind) => {
    setBusy(kind);
    try {
      await remindNow(organisationId, kind);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reminders could not be sent.");
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!settings) return;
    setBusy("save");
    try {
      await saveClubReminderSettings(organisationId, settings);
      toast.success("Reminder settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const senders: { kind: Kind; label: string; hint: string; allowed: boolean }[] = [
    {
      kind: "availability",
      label: "Availability",
      hint: "Everyone who hasn't replied to an open event.",
      allowed: can(role, "events.manage"),
    },
    {
      kind: "fees",
      label: "Fees",
      hint: "Everyone with a fee still to pay.",
      allowed: can(role, "fees.manage"),
    },
    {
      kind: "umpires",
      label: "Umpires",
      hint: "Unanswered offers, and jobs in the next 7 days.",
      allowed: can(role, "umpires.manage"),
    },
  ];
  const channels: { label: string; ready: boolean; note: string }[] = [
    { label: "In the app", ready: true, note: "Always on — the bell at the top." },
    {
      label: "Phone alerts",
      ready: Boolean(setup?.pushKey),
      note: "Each person turns them on for their phone.",
    },
    {
      label: "Email",
      ready: Boolean(setup?.email),
      note: setup?.email
        ? "To each person's sign-in email."
        : "Starts once CricLume's sending address is switched on.",
    },
    {
      label: "WhatsApp and texts",
      ready: Boolean(setup?.texts) && paidPlan,
      note: !paidPlan
        ? "Included on paid plans."
        : setup?.texts
          ? "To people who added their mobile number."
          : "Starts once CricLume's messaging account is connected.",
    },
  ];

  return (
    <div className="space-y-4">
      <OfficeCard
        title="Send reminders now"
        description="Each person gets at most one of these an hour, on the ways they chose."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {senders
            .filter((item) => item.allowed)
            .map((item) => (
              <button
                key={item.kind}
                type="button"
                className="office-row flex-nowrap text-left"
                disabled={busy !== null}
                onClick={() => void send(item.kind)}
              >
                <span className="min-w-0">
                  <span className="block font-bold">{item.label}</span>
                  <span className="office-meta block">{item.hint}</span>
                </span>
                {busy === item.kind ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            ))}
        </div>
      </OfficeCard>

      <OfficeCard title="Automatic reminders" description="Checked every hour.">
        {!settings ? (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        ) : (
          <div className="space-y-3">
            <Toggle
              label="Availability"
              hint="To players and parents who haven't replied."
              checked={settings.availability}
              disabled={!admin}
              onChange={(availability) => setSettings({ ...settings, availability })}
            >
              <OfficeField label="How early">
                <select
                  className="scorer-input"
                  disabled={!admin}
                  value={settings.availability_hours}
                  onChange={(event) =>
                    setSettings({ ...settings, availability_hours: Number(event.target.value) })
                  }
                >
                  {[6, 12, 24, 48, 72].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours} hours before replies close
                    </option>
                  ))}
                </select>
              </OfficeField>
            </Toggle>
            <Toggle
              label="Fees"
              hint="Before the due date, then weekly for up to 8 weeks while unpaid."
              checked={settings.fees}
              disabled={!admin}
              onChange={(fees) => setSettings({ ...settings, fees })}
            >
              <OfficeField label="First reminder">
                <select
                  className="scorer-input"
                  disabled={!admin}
                  value={settings.fee_days}
                  onChange={(event) =>
                    setSettings({ ...settings, fee_days: Number(event.target.value) })
                  }
                >
                  {[0, 1, 3, 7, 14].map((days) => (
                    <option key={days} value={days}>
                      {days === 0
                        ? "On the due date"
                        : `${days} day${days === 1 ? "" : "s"} before it's due`}
                    </option>
                  ))}
                </select>
              </OfficeField>
            </Toggle>
            <Toggle
              label="Umpiring jobs"
              hint="Daily while an offer is unanswered, and the day before a match."
              checked={settings.umpire_jobs}
              disabled={!admin}
              onChange={(umpire_jobs) => setSettings({ ...settings, umpire_jobs })}
            />
            <Toggle
              label="Use WhatsApp and texts"
              hint={
                paidPlan
                  ? "For people who chose them and added a number."
                  : "Included on paid plans."
              }
              checked={settings.texts && paidPlan}
              disabled={!admin || !paidPlan}
              onChange={(texts) => setSettings({ ...settings, texts })}
            />
            {admin ? (
              <button
                type="button"
                className="action-primary"
                disabled={busy !== null}
                onClick={() => void save()}
              >
                Save settings
              </button>
            ) : (
              <p className="office-meta">Only the club owner or admins can change these.</p>
            )}
          </div>
        )}
      </OfficeCard>

      <OfficeCard
        title="How reminders arrive"
        description="Everyone picks their own ways under the bell → How to reach me."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {channels.map((channel) => (
            <li key={channel.label} className="office-row">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-bold">
                  <BellRing className="size-3.5" /> {channel.label}
                </span>
                <span className="office-meta block">{channel.note}</span>
              </span>
              <Pill tone={channel.ready ? "good" : "warn"}>{channel.ready ? "On" : "Waiting"}</Pill>
            </li>
          ))}
        </ul>
      </OfficeCard>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="office-row">
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        <span className="office-meta block">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
      {checked && children && <div className="w-full">{children}</div>}
    </div>
  );
}
