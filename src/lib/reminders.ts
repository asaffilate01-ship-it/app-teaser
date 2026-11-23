/**
 * Reminders (availability, fees, umpire jobs): the wording every channel uses and which channels
 * a reminder goes out on. Pure, so the same text shows in the app, on phones, by email and by text.
 */

export type ReminderTemplate = "reminder.availability" | "reminder.fee" | "reminder.umpire";
export type ReminderChannel = "push" | "email" | "whatsapp" | "sms";
export const reminderChannels: ReminderChannel[] = ["push", "email", "whatsapp", "sms"];

export const channelLabels: Record<ReminderChannel, string> = {
  push: "Phone alert",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "Text message",
};

export interface ReminderPreferences {
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
  phone: string | null;
  availability: boolean;
  fees: boolean;
  umpire_jobs: boolean;
}

/** What someone gets before they have saved their own choices: phone alerts and email, no texts. */
export const defaultPreferences: ReminderPreferences = {
  push: true,
  email: true,
  whatsapp: false,
  sms: false,
  phone: null,
  availability: true,
  fees: true,
  umpire_jobs: true,
};

export interface ReminderMessage {
  title: string;
  body: string;
}

type Payload = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function dateLabel(iso: unknown, timeZone: string, withTime = true): string {
  if (typeof iso !== "string" || !iso) return "";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      timeZone: iso.length === 10 ? "UTC" : timeZone,
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}

/** Money stored in minor units (pence, paisa) shown in its currency. */
export function formatOwed(minor: unknown, currency: unknown): string {
  const amount = typeof minor === "number" ? minor : Number(minor);
  const code = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "GBP";
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(amount / 100);
  } catch {
    return `${code} ${(amount / 100).toFixed(2)}`;
  }
}

/** The title and text for one reminder. `now` decides whether a fee is overdue. */
export function reminderMessage(template: string, payload: Payload, options: { timeZone?: string; now?: Date } = {}): ReminderMessage {
  const timeZone = options.timeZone || "Europe/London";
  const now = options.now ?? new Date();
  const club = text(payload["club_name"]) || "Your club";
  if (template === "reminder.availability") {
    const event = text(payload["event_title"]) || "the next event";
    const starts = dateLabel(payload["starts_at"], timeZone);
    const replyBy = dateLabel(payload["reply_by"], timeZone);
    const who = payload["self"] === true || !text(payload["player_name"]) ? "" : ` for ${text(payload["player_name"])}`;
    return {
      title: `Are you available? ${event}`,
      body: `${club}: please reply${who} for ${event}${starts ? ` on ${starts}` : ""}.${replyBy ? ` Replies close ${replyBy}.` : ""}`,
    };
  }
  if (template === "reminder.fee") {
    const owed = formatOwed(payload["owed_minor"], payload["currency"]);
    const what = text(payload["description"]) || "Club fees";
    const dueOn = text(payload["due_on"]);
    const overdue = dueOn !== "" && dueOn < now.toISOString().slice(0, 10);
    const due = dueOn ? dateLabel(dueOn, timeZone, false) : "";
    const who = payload["self"] === true || !text(payload["player_name"]) ? "" : ` for ${text(payload["player_name"])}`;
    return {
      title: overdue ? `Fee overdue — ${club}` : `Fee reminder — ${club}`,
      body: `${what}${who}: ${owed} still to pay${due ? (overdue ? `, was due ${due}` : `, due ${due}`) : ""}. Pay by transfer and add your reference in CricLume.`,
    };
  }
  if (template === "reminder.umpire") {
    const job = text(payload["title"]) || "Umpiring appointment";
    const starts = dateLabel(payload["starts_at"], timeZone);
    const venue = text(payload["venue"]);
    if (payload["status"] === "offered") {
      return {
        title: `Umpiring offer: ${job}`,
        body: `${club} asked you to umpire${starts ? ` on ${starts}` : ""}${venue ? ` at ${venue}` : ""}. Please accept or decline.`,
      };
    }
    const report = dateLabel(payload["report_at"], timeZone);
    const meet = text(payload["meet_point"]);
    return {
      title: `Umpiring reminder: ${job}`,
      body: `You're umpiring for ${club}${starts ? ` on ${starts}` : ""}${venue ? ` at ${venue}` : ""}.${report ? ` Report by ${report}.` : ""}${meet ? ` Meet at ${meet}.` : ""}`,
    };
  }
  return { title: "CricLume reminder", body: club };
}

/** One short line for WhatsApp and text messages, with the link to act on it. */
export function textMessage(message: ReminderMessage, url: string): string {
  const line = `CricLume: ${message.title}. ${message.body}`;
  const room = 320 - url.length - 1;
  return `${line.length > room ? `${line.slice(0, room - 1)}…` : line} ${url}`;
}

/** Turns what someone typed into an international number (+44…), or null when it can't be one. */
export function normalisePhone(input: string): string | null {
  let value = input.replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

/**
 * Which channels one reminder goes out on. In-app always happens (the reminder is saved there).
 * WhatsApp and texts need a number, a paid club plan and the club's switch left on.
 */
export function channelsFor(input: {
  prefs: ReminderPreferences | null;
  devices: number;
  email: string | null;
  paidPlan: boolean;
  clubTexts: boolean;
}): ReminderChannel[] {
  const prefs = input.prefs ?? defaultPreferences;
  const texts = input.paidPlan && input.clubTexts && prefs.phone !== null;
  const out: ReminderChannel[] = [];
  if (prefs.push && input.devices > 0) out.push("push");
  if (prefs.email && input.email) out.push("email");
  if (prefs.whatsapp && texts) out.push("whatsapp");
  if (prefs.sms && texts) out.push("sms");
  return out;
}
