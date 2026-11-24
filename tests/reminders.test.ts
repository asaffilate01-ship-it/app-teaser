import { describe, it } from "node:test";
import { expect } from "./assert-expect.ts";
import {
  channelsFor,
  defaultPreferences,
  normalisePhone,
  reminderMessage,
  textMessage,
} from "../src/lib/reminders.ts";

const base = { devices: 1, email: "a@b.com", paidPlan: true, clubTexts: true };

describe("reminder channels", () => {
  it("defaults to phone alerts and email only", () => {
    expect(channelsFor({ ...base, prefs: null })).toEqual(["push", "email"]);
  });
  it("sends WhatsApp and texts only on a paid plan", () => {
    const prefs = { ...defaultPreferences, whatsapp: true, sms: true, phone: "+923001234567" };
    expect(channelsFor({ ...base, prefs })).toEqual(["push", "email", "whatsapp", "sms"]);
    expect(channelsFor({ ...base, prefs, paidPlan: false })).toEqual(["push", "email"]);
  });
  it("sends no texts when the club switched them off or there is no number", () => {
    const prefs = { ...defaultPreferences, sms: true, phone: "+447700900123" };
    expect(channelsFor({ ...base, prefs, clubTexts: false })).not.toContain("sms");
    expect(channelsFor({ ...base, prefs: { ...prefs, phone: null } })).not.toContain("sms");
  });
  it("skips phone alerts with no device and email with no confirmed address", () => {
    expect(channelsFor({ ...base, prefs: null, devices: 0, email: null })).toEqual([]);
  });
});

describe("reminder wording", () => {
  it("asks a parent to reply for their child", () => {
    const message = reminderMessage(
      "reminder.availability",
      {
        event_title: "Sat v Oakfield",
        starts_at: "2026-11-28T10:00:00Z",
        player_name: "Ali",
        self: false,
        club_name: "Riverside CC",
      },
      { timeZone: "UTC" },
    );
    expect(message.body).toContain("please reply for Ali");
    expect(message.body).toContain("Riverside CC");
  });
  it("marks a fee overdue after its due date and shows what is owed", () => {
    const message = reminderMessage(
      "reminder.fee",
      {
        description: "Annual subs",
        owed_minor: 2500,
        currency: "GBP",
        due_on: "2026-11-01",
        self: true,
        club_name: "Riverside CC",
      },
      { now: new Date("2026-11-20T09:00:00Z") },
    );
    expect(message.title).toBe("Fee overdue — Riverside CC");
    expect(message.body).toContain("£25.00");
  });
  it("asks an umpire to accept or decline an open offer", () => {
    expect(
      reminderMessage("reminder.umpire", { title: "Div 1", status: "offered" }).body,
    ).toContain("accept or decline");
  });
  it("keeps text messages to 320 characters including the link", () => {
    const url = "https://criclume.com/platform?section=office";
    const out = textMessage({ title: "x".repeat(200), body: "y".repeat(300) }, url);
    expect(out.length).toBeLessThanOrEqual(320);
    expect(out.endsWith(url)).toBe(true);
  });
  it("accepts numbers written with 00 or spaces, rejects local-only numbers", () => {
    expect(normalisePhone("0092 300 1234567")).toBe("+923001234567");
    expect(normalisePhone("07700 900123")).toBeNull();
  });
});
