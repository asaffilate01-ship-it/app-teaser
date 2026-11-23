import type { CommentaryLine } from "@/lib/commentary";

export function CommentaryFeed({ lines, empty = "Ball-by-ball text appears here after the first ball." }: { lines: CommentaryLine[]; empty?: string }) {
  if (!lines.length) return <p className="scoreboard-muted text-sm">{empty}</p>;
  return (
    <ol className="commentary-feed" aria-live="polite">
      {lines.map((line) =>
        line.tone === "over" ? (
          <li key={line.id} className="commentary-over">
            <strong>{line.over}</strong>
            <span>{line.text}</span>
          </li>
        ) : (
          <li key={line.id} className="commentary-line" data-tone={line.tone}>
            <span className="commentary-ball">{line.over}</span>
            <p>{line.text}</p>
          </li>
        ),
      )}
    </ol>
  );
}
