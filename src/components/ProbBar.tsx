import { pct } from "../lib/format";
import "./ProbBar.css";

interface Props {
  home: number;
  draw: number;
  away: number;
  pick?: "HOME" | "DRAW" | "AWAY";
  hasDraw?: boolean;
  homeLabel?: string;
  awayLabel?: string;
  compact?: boolean;
}

/** Stacked win / draw / loss probability bar (draw hidden for 2-outcome sports). */
export default function ProbBar({
  home,
  draw,
  away,
  pick,
  hasDraw = true,
  homeLabel = "Home",
  awayLabel = "Away",
  compact,
}: Props) {
  return (
    <div className={`probbar ${compact ? "compact" : ""}`}>
      <div className="probbar-track" role="img" aria-label={`${homeLabel} ${pct(home)}, ${awayLabel} ${pct(away)}`}>
        <span className={`seg home ${pick === "HOME" ? "lead" : ""}`} style={{ width: `${home * 100}%` }} />
        {hasDraw && <span className={`seg draw ${pick === "DRAW" ? "lead" : ""}`} style={{ width: `${draw * 100}%` }} />}
        <span className={`seg away ${pick === "AWAY" ? "lead" : ""}`} style={{ width: `${away * 100}%` }} />
      </div>
      {!compact && (
        <div className="probbar-legend">
          <span className={pick === "HOME" ? "lead" : ""}>
            <b>{pct(home)}</b> {homeLabel}
          </span>
          {hasDraw && (
            <span className={pick === "DRAW" ? "lead" : ""}>
              <b>{pct(draw)}</b> Draw
            </span>
          )}
          <span className={pick === "AWAY" ? "lead" : ""}>
            <b>{pct(away)}</b> {awayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
