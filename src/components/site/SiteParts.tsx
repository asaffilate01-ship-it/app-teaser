import { useEffect, useState, type ReactNode } from "react";
import { Link, useHydrated } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Pin,
  Radio,
  X,
} from "lucide-react";
import {
  liveScoreLine,
  postExcerpt,
  postKindLabels,
  type SiteMatch,
  type SitePhoto,
  type SitePost,
  type SiteTable,
  type UpcomingItem,
} from "@/lib/club-site";

export function SiteCrest({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word) && !/^(cricket|club|cc|the|of)$/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <span className={large ? "club-crest club-crest-lg" : "club-crest"} aria-hidden="true">
      {initials || name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="club-section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/** Dates show in UTC while the page is drawn on the server, then switch to the visitor's own time and language. */
export function dateLabel(iso: string | null, withTime = true, local = true): string {
  if (!iso) return "Date to be confirmed";
  const date = new Date(iso);
  return date.toLocaleString(local ? undefined : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
    ...(local ? {} : { timeZone: "UTC" }),
  });
}

export function useDateLabel() {
  const local = useHydrated();
  return (iso: string | null, withTime = true) => dateLabel(iso, withTime, local);
}

export function LiveCard({ match }: { match: SiteMatch }) {
  const body = (
    <>
      <span className="club-live-badge">
        <Radio aria-hidden="true" /> {match.status === "innings_break" ? "Innings break" : "Live"}
      </span>
      <p className="club-live-teams">
        {match.home} <span>v</span> {match.away}
      </p>
      <p className="club-live-score">{liveScoreLine(match)}</p>
      {match.ground && (
        <p className="club-meta">
          <MapPin aria-hidden="true" /> {match.ground}
        </p>
      )}
      {match.scoreboard && <span className="club-live-cta">Follow ball by ball →</span>}
    </>
  );
  return match.scoreboard ? (
    <Link to="/scoreboard/$slug" params={{ slug: match.scoreboard }} className="club-live-card">
      {body}
    </Link>
  ) : (
    <div className="club-live-card">{body}</div>
  );
}

export function UpcomingRow({ item }: { item: UpcomingItem }) {
  const local = useHydrated();
  const label = useDateLabel();
  const date = item.when ? new Date(item.when) : null;
  const zone = local ? {} : { timeZone: "UTC" };
  return (
    <li className="club-fixture">
      <div className="club-fixture-date" aria-hidden={!date}>
        {date ? (
          <>
            <strong>
              {date.toLocaleDateString(local ? undefined : "en-GB", { day: "numeric", ...zone })}
            </strong>
            <span>
              {date.toLocaleDateString(local ? undefined : "en-GB", { month: "short", ...zone })}
            </span>
          </>
        ) : (
          <CalendarDays />
        )}
      </div>
      <div className="min-w-0">
        <p className="club-fixture-teams">
          {item.home} <span>v</span> {item.away}
        </p>
        <p className="club-meta">
          {label(item.when)}
          {item.ground ? ` · ${item.ground}` : ""}
        </p>
        {item.label && <p className="club-tag">{item.label}</p>}
      </div>
    </li>
  );
}

export function ResultRow({ match }: { match: SiteMatch }) {
  const label = useDateLabel();
  return (
    <li className="club-result">
      <div className="min-w-0">
        <p className="club-fixture-teams">
          {match.home} <span>v</span> {match.away}
        </p>
        <p className="club-result-text">
          {match.status === "abandoned" ? "Abandoned" : (match.result ?? "Result to follow")}
        </p>
        <p className="club-meta">
          {label(match.completedAt ?? match.startedAt ?? match.scheduledAt, false)}
          {match.ground ? ` · ${match.ground}` : ""}
        </p>
      </div>
      {match.scoreboard && (
        <Link
          to="/scoreboard/$slug"
          params={{ slug: match.scoreboard }}
          className="club-button club-button-ghost club-button-sm"
        >
          Scorecard
        </Link>
      )}
    </li>
  );
}

export function PostCard({
  post,
  slug,
  files,
}: {
  post: SitePost;
  slug: string;
  files: Record<string, string>;
}) {
  const label = useDateLabel();
  const file = post.filePath ? files[post.filePath] : null;
  const isPdf = post.filePath?.toLowerCase().endsWith(".pdf");
  return (
    <article className="club-post">
      <p className="club-post-kind">
        {post.pinned && <Pin aria-label="Pinned" />}
        {postKindLabels[post.kind]} · {label(post.publishedAt, false)}
      </p>
      {file && !isPdf && <img src={file} alt="" className="club-post-image" loading="lazy" />}
      <h3>
        <Link to="/club/$slug/news/$postId" params={{ slug, postId: post.id }}>
          {post.title}
        </Link>
      </h3>
      {post.body && <p>{postExcerpt(post.body)}</p>}
      {post.kind === "document" && (file || post.linkUrl) && (
        <a
          href={(isPdf && file) || post.linkUrl || file || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="club-doc-link"
        >
          <FileText aria-hidden="true" /> Open document
        </a>
      )}
    </article>
  );
}

export function LeagueTableView({ table }: { table: SiteTable }) {
  return (
    <section className="club-card" aria-label={`${table.competition.name} table`}>
      <div className="club-table-head">
        <h3>{table.competition.name}</h3>
        <p className="club-meta">
          {[
            table.competition.season,
            `${table.counted} confirmed result${table.counted === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="club-table-wrap">
        <table className="club-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col" title="Played">
                P
              </th>
              <th scope="col" title="Won">
                W
              </th>
              <th scope="col" title="Lost">
                L
              </th>
              <th scope="col" title="Tied or no result">
                T/NR
              </th>
              <th scope="col" title="Net run rate">
                NRR
              </th>
              <th scope="col" title="Points">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={row.teamId}>
                <td>{index + 1}</td>
                <th scope="row">{row.name}</th>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.lost}</td>
                <td>{row.tied + row.noResult}</td>
                <td>{(row.netRunRate >= 0 ? "+" : "") + row.netRunRate.toFixed(3)}</td>
                <td className="club-table-pts">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="club-meta mt-2">Only results confirmed by the league count.</p>
    </section>
  );
}

export function PhotoGrid({
  photos,
  files,
  limit,
}: {
  photos: SitePhoto[];
  files: Record<string, string>;
  limit?: number;
}) {
  const shown = photos.filter((photo) => files[photo.path]).slice(0, limit ?? photos.length);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % shown.length));
      if (event.key === "ArrowLeft")
        setOpen((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shown.length]);
  if (shown.length === 0) return <p className="club-meta">No photos yet.</p>;
  const current = open === null ? null : shown[open];
  return (
    <>
      <ul className="club-photos">
        {shown.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              aria-label={photo.caption || `Photo ${index + 1}`}
            >
              <img src={files[photo.path]} alt={photo.caption} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <div
          className="club-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.caption || "Photo"}
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            className="club-lightbox-close"
            aria-label="Close"
            onClick={() => setOpen(null)}
          >
            <X />
          </button>
          {shown.length > 1 && (
            <button
              type="button"
              className="club-lightbox-step club-lightbox-prev"
              aria-label="Previous photo"
              onClick={(event) => {
                event.stopPropagation();
                setOpen((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
              }}
            >
              <ChevronLeft />
            </button>
          )}
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={files[current.path]} alt={current.caption} />
            {current.caption && <figcaption>{current.caption}</figcaption>}
          </figure>
          {shown.length > 1 && (
            <button
              type="button"
              className="club-lightbox-step club-lightbox-next"
              aria-label="Next photo"
              onClick={(event) => {
                event.stopPropagation();
                setOpen((i) => (i === null ? i : (i + 1) % shown.length));
              }}
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </>
  );
}
