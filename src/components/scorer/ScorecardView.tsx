import { useState } from "react";
import { bowlingCard, findTeam, type CricketMatch } from "@/lib/cricket";
import { battingSplit, fallOfWickets, inningsHeadline } from "@/lib/scorecard";

type View = "batting" | "bowling" | "wickets";

/** Mobile-first scorecard: innings switcher, batting/bowling/wickets tabs, no sideways scrolling. */
export function ScorecardView({ match }: { match: CricketMatch }) {
  const [selected, setSelected] = useState(match.innings.length - 1);
  const [view, setView] = useState<View>("batting");
  const innings = match.innings[selected] ?? match.innings.at(-1)!;
  const team = findTeam(match, innings.battingTeamId);
  const head = inningsHeadline(match, innings);
  const { batted, yetToBat } = battingSplit(match, innings);
  const bowling = bowlingCard(match, innings);
  const wickets = fallOfWickets(match, innings);

  return (
    <section className="card-view" aria-label="Scorecard">
      {match.innings.length > 1 && (
        <div className="card-innings" role="tablist" aria-label="Innings">
          {match.innings.map((item, index) => {
            const itemHead = inningsHeadline(match, item);
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === selected}
                onClick={() => setSelected(index)}
              >
                <span className="truncate">{findTeam(match, item.battingTeamId).name}</span>
                <strong>
                  {itemHead.label} <small>({itemHead.overs})</small>
                </strong>
              </button>
            );
          })}
        </div>
      )}

      <div className="card-summary">
        <div className="min-w-0">
          <p className="panel-kicker">Innings {innings.number}</p>
          <h2 className="truncate font-display text-2xl font-bold">{team.name}</h2>
        </div>
        <div className="text-right">
          <p className="card-total">{head.label}</p>
          <p className="card-sub">
            {head.overs} ov · RR {head.runRate.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="card-tabs" role="tablist" aria-label="Scorecard section">
        {(
          [
            ["batting", "Batting"],
            ["bowling", "Bowling"],
            ["wickets", `Wickets ${wickets.length ? `(${wickets.length})` : ""}`],
          ] as [View, string][]
        ).map(([key, text]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}>
            {text}
          </button>
        ))}
      </div>

      {view === "batting" && (
        <div className="card-table" role="table" aria-label={`${team.name} batting`}>
          <div className="card-row card-head card-bat" role="row">
            <span role="columnheader">Batter</span>
            <span role="columnheader">R</span>
            <span role="columnheader">B</span>
            <span role="columnheader">4s</span>
            <span role="columnheader">6s</span>
            <span role="columnheader">SR</span>
          </div>
          {batted.length === 0 && <p className="card-empty">No one has batted yet.</p>}
          {batted.map((row) => (
            <div key={row.playerId} className={`card-row card-bat ${row.atCrease ? "card-live" : ""}`} role="row">
              <span role="cell" className="card-name">
                <strong className="truncate">
                  {row.name}
                  {row.onStrike ? " *" : ""}
                </strong>
                <small className="truncate">{row.atCrease ? "batting" : row.dismissal}</small>
              </span>
              <span role="cell" className="card-big">{row.runs}</span>
              <span role="cell">{row.balls}</span>
              <span role="cell">{row.fours}</span>
              <span role="cell">{row.sixes}</span>
              <span role="cell">{row.balls ? row.strikeRate.toFixed(0) : "–"}</span>
            </div>
          ))}
          <div className="card-row card-extras" role="row">
            <span role="cell">
              Extras{" "}
              <small>
                {head.extras.wide}w {head.extras.noBall}nb {head.extras.bye}b {head.extras.legBye}lb
                {head.extras.penalty ? ` ${head.extras.penalty}p` : ""}
              </small>
            </span>
            <strong role="cell">{head.extras.total}</strong>
          </div>
          <div className="card-row card-extras card-grand" role="row">
            <span role="cell">Total</span>
            <strong role="cell">
              {head.label} <small>({head.overs} ov)</small>
            </strong>
          </div>
          {yetToBat.length > 0 && (
            <p className="card-yet">
              <span>Yet to bat:</span> {yetToBat.join(", ")}
            </p>
          )}
        </div>
      )}

      {view === "bowling" && (
        <div className="card-table" role="table" aria-label={`${findTeam(match, innings.bowlingTeamId).name} bowling`}>
          <div className="card-row card-head card-bowl" role="row">
            <span role="columnheader">Bowler</span>
            <span role="columnheader">O</span>
            <span role="columnheader">M</span>
            <span role="columnheader">R</span>
            <span role="columnheader">W</span>
            <span role="columnheader">Econ</span>
          </div>
          {bowling.length === 0 && <p className="card-empty">No bowling figures yet.</p>}
          {bowling.map((row) => (
            <div key={row.playerId} className={`card-row card-bowl ${row.playerId === innings.bowlerId && innings.status === "live" ? "card-live" : ""}`} role="row">
              <span role="cell" className="card-name">
                <strong className="truncate">{row.name}</strong>
                {row.wides || row.noBalls ? (
                  <small>
                    {row.wides}wd {row.noBalls}nb
                  </small>
                ) : null}
              </span>
              <span role="cell">{row.overs}</span>
              <span role="cell">{row.maidens}</span>
              <span role="cell">{row.runs}</span>
              <span role="cell" className="card-big">{row.wickets}</span>
              <span role="cell">{row.balls ? row.economy.toFixed(1) : "–"}</span>
            </div>
          ))}
        </div>
      )}

      {view === "wickets" && (
        <ol className="card-fow">
          {wickets.length === 0 && <li className="card-empty">No wickets yet.</li>}
          {wickets.map((item) => (
            <li key={item.wicket}>
              <span className="card-fow-score">
                {item.score}-{item.wicket}
              </span>
              <span className="min-w-0 truncate">{item.batter}</span>
              <span className="card-sub">{item.over} ov</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
