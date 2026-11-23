/**
 * WhatsApp and text messages through the connected Twilio account (server only).
 * Sender: TWILIO_SMS_FROM / TWILIO_WHATSAPP_FROM if set, otherwise the account's first number.
 * WhatsApp outside a chat needs a Meta-approved template: set TWILIO_WHATSAPP_CONTENT_SID
 * (variables {{1}} = title, {{2}} = text) and it is used automatically.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type TextOutcome = "sent" | "failed" | "not-set-up";

export function textsConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["TWILIO_API_KEY"]);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"] ?? ""}`,
    "X-Connection-Api-Key": process.env["TWILIO_API_KEY"] ?? "",
  };
}

let accountNumber: Promise<string | null> | null = null;
function firstAccountNumber(): Promise<string | null> {
  accountNumber ??= fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json?PageSize=20`, { headers: headers() })
    .then(async (response) => {
      if (!response.ok) {
        console.error(`Twilio number lookup failed [${response.status}]: ${await response.text()}`);
        return null;
      }
      const body = (await response.json()) as { incoming_phone_numbers?: { phone_number?: string; capabilities?: { sms?: boolean } }[] };
      return body.incoming_phone_numbers?.find((item) => item.capabilities?.sms !== false)?.phone_number ?? null;
    })
    .catch(() => null);
  return accountNumber;
}

export async function sendText(input: { to: string; title: string; text: string; whatsapp: boolean }): Promise<TextOutcome> {
  if (!textsConfigured()) return "not-set-up";
  const configured = input.whatsapp ? process.env["TWILIO_WHATSAPP_FROM"] || process.env["TWILIO_SMS_FROM"] : process.env["TWILIO_SMS_FROM"];
  const from = configured || (await firstAccountNumber());
  if (!from) return "not-set-up";
  const body = new URLSearchParams({
    To: input.whatsapp ? `whatsapp:${input.to}` : input.to,
    From: input.whatsapp ? `whatsapp:${from.replace(/^whatsapp:/, "")}` : from,
  });
  const contentSid = process.env["TWILIO_WHATSAPP_CONTENT_SID"];
  if (input.whatsapp && contentSid) {
    body.set("ContentSid", contentSid);
    body.set("ContentVariables", JSON.stringify({ 1: input.title.slice(0, 120), 2: input.text.slice(0, 900) }));
  } else {
    body.set("Body", input.text);
  }
  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      console.error(`Twilio send failed [${response.status}]: ${await response.text()}`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Twilio send failed", error);
    return "failed";
  }
}
