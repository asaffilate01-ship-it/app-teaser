export type CricLumeCalendarFixture = {
  id: string;
  startsAt: string | null;
  homeTeam: string;
  awayTeam: string;
  ground: string | null;
  round: string | null;
  status: string;
};

function plain(value: string): string {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim()
    .slice(0, 500);
}

function escapeCalendarText(value: string): string {
  return plain(value).replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,");
}

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let folded = "";
  let bytes = 0;
  for (const character of Array.from(line)) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      folded += "\r\n ";
      bytes = 1;
    }
    folded += character;
    bytes += length;
  }
  return folded;
}

function startUtc(value: string | null): string | null {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return null;
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Creates an RFC 5545 iCalendar export from scheduled club fixtures only.
 * No unrecorded start times, match durations or ground locations are invented.
 * This is a local download, not an external calendar subscription or publish API.
 */
export function fixtureCalendarIcs(input: {
  competitionId: string;
  competitionName: string;
  seasonName: string;
  fixtures: CricLumeCalendarFixture[];
  generatedAt?: Date;
}) {
  const stamp = startUtc((input.generatedAt ?? new Date()).toISOString());
  if (!stamp) throw new Error("A valid calendar generation date is required.");
  const items = input.fixtures.slice(0, 5000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CricLume//Fixtures//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeCalendarText(input.competitionName)}`,
  ];
  let included = 0;
  for (const fixture of items) {
    const starts = startUtc(fixture.startsAt);
    if (!starts) continue;
    const reference = plain(`${input.competitionId}-${fixture.id}`)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 180);
    const description = [input.seasonName, fixture.round, fixture.status]
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:criclume-${reference}@criclume.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${starts}`,
      `SUMMARY:${escapeCalendarText(`${fixture.homeTeam} v ${fixture.awayTeam}`)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
    );
    if (fixture.ground) lines.push(`LOCATION:${escapeCalendarText(fixture.ground)}`);
    lines.push("END:VEVENT");
    included += 1;
  }
  lines.push("END:VCALENDAR");
  return {
    contents: lines.map(foldLine).join("\r\n") + "\r\n",
    included,
    skipped: input.fixtures.length - included,
  };
}
