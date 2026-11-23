/**
 * Email reminders. CricLume's own sending address (criclume.com) has to be set up before app
 * emails can go out; until then this reports "not-set-up" and the other channels still deliver.
 * Once set up, send the "reminder" template through the email helper here.
 */
export type EmailOutcome = "sent" | "failed" | "not-set-up" | "suppressed";

export function emailConfigured(): boolean {
  return false;
}

export async function sendReminderEmail(_input: {
  to: string;
  title: string;
  text: string;
  url: string;
  idempotencyKey: string;
}): Promise<EmailOutcome> {
  return "not-set-up";
}
