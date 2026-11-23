import type { CommentaryLine } from "./commentary.ts";

/** Words a speech voice reads for one line. Ball "12.3" is the third ball of the 13th over. */
export function speechText(line: CommentaryLine): string {
  const text = line.text.replace(/\s+/g, " ").trim();
  if (line.tone === "over") return `${line.over}. ${text}`;
  const [over, ball] = line.over.split(".");
  const overNumber = Number(over);
  return ball && Number.isInteger(overNumber) ? `Over ${overNumber + 1}, ball ${ball}. ${text}` : `${line.over}. ${text}`;
}

/**
 * New lines to read aloud, oldest first. `lines` is newest first (as the feed shows them).
 * When nothing has been read yet only the newest line is read, so switching on does not replay the innings.
 * At most `max` lines are read in one go so a reconnect does not queue a long backlog.
 */
export function linesToSpeak(lines: readonly CommentaryLine[], spoken: ReadonlySet<string>, max = 3): CommentaryLine[] {
  if (lines.length === 0) return [];
  if (spoken.size === 0) return [lines[0]!];
  const fresh: CommentaryLine[] = [];
  for (const line of lines) {
    if (spoken.has(line.id)) break;
    fresh.push(line);
  }
  return fresh.slice(0, max).reverse();
}
